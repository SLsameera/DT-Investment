const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../config/database');

class DocumentService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || 'uploads';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
    this.allowedTypes = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    };
    this.documentTypes = {
      'nic_front': 'National ID Card (Front)',
      'nic_back': 'National ID Card (Back)',
      'passport': 'Passport',
      'driving_license': 'Driving License',
      'birth_certificate': 'Birth Certificate',
      'utility_bill': 'Utility Bill',
      'bank_statement': 'Bank Statement',
      'salary_slip': 'Salary Slip',
      'employment_letter': 'Employment Letter',
      'business_registration': 'Business Registration',
      'tax_return': 'Tax Return',
      'other': 'Other Document'
    };
  }

  /**
   * Configure multer for file uploads
   * @returns {Object} Multer middleware
   */
  getUploadMiddleware() {
    const storage = multer.memoryStorage();
    
    const fileFilter = (req, file, cb) => {
      if (this.allowedTypes[file.mimetype]) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} is not allowed`), false);
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: this.maxFileSize,
        files: 10 // Max 10 files per upload
      }
    });
  }

  /**
   * Upload and process documents for a customer
   * @param {number} customerId - Customer ID
   * @param {Array} files - Array of uploaded files
   * @param {number} uploadedBy - User ID who uploaded the files
   * @param {Object} metadata - Additional metadata for documents
   * @returns {Array} Array of uploaded document objects
   */
  async uploadDocuments(customerId, files, uploadedBy, metadata = {}) {
    try {
      return await transaction(async (client) => {
        const uploadedDocs = [];

        // Ensure upload directories exist
        await this.ensureDirectoriesExist(customerId);

        for (const file of files) {
          // Validate file
          await this.validateFile(file);

          // Generate unique filename
          const fileId = uuidv4();
          const extension = this.allowedTypes[file.mimetype];
          const filename = `${fileId}.${extension}`;
          const relativePath = `customers/${customerId}/${filename}`;
          const absolutePath = path.join(this.uploadDir, relativePath);

          // Process and save file
          await this.processAndSaveFile(file, absolutePath);

          // Generate thumbnail for images
          let thumbnailPath = null;
          if (file.mimetype.startsWith('image/')) {
            thumbnailPath = await this.generateThumbnail(absolutePath, customerId, fileId);
          }

          // Calculate file hash for integrity
          const fileHash = await this.calculateFileHash(file.buffer);

          // Get document type from metadata or filename
          const documentType = metadata.document_type || this.inferDocumentType(file.originalname);

          // Save document record to database
          const result = await client.query(`
            INSERT INTO customer_documents (
              customer_id, file_id, original_name, filename, file_path,
              file_size, mime_type, document_type, file_hash,
              thumbnail_path, uploaded_by, metadata, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'uploaded')
            RETURNING *
          `, [
            customerId,
            fileId,
            file.originalname,
            filename,
            relativePath,
            file.size,
            file.mimetype,
            documentType,
            fileHash,
            thumbnailPath,
            uploadedBy,
            JSON.stringify(metadata)
          ]);

          const document = result.rows[0];
          uploadedDocs.push(this.formatDocumentResponse(document));

          // Log document upload
          await this.logDocumentActivity(client, document.id, uploadedBy, 'document_uploaded', {
            document_type: documentType,
            filename: file.originalname,
            file_size: file.size
          });
        }

        return uploadedDocs;
      });
    } catch (error) {
      console.error('Error uploading documents:', error);
      throw error;
    }
  }

  /**
   * Get documents for a customer
   * @param {number} customerId - Customer ID
   * @param {Object} filters - Optional filters
   * @returns {Array} Array of document objects
   */
  async getCustomerDocuments(customerId, filters = {}) {
    try {
      let whereClause = 'WHERE customer_id = $1';
      const queryParams = [customerId];
      let paramCount = 2;

      if (filters.document_type) {
        whereClause += ` AND document_type = $${paramCount}`;
        queryParams.push(filters.document_type);
        paramCount++;
      }

      if (filters.status) {
        whereClause += ` AND status = $${paramCount}`;
        queryParams.push(filters.status);
        paramCount++;
      }

      const result = await query(`
        SELECT 
          cd.*,
          u.first_name as uploaded_by_first_name,
          u.last_name as uploaded_by_last_name
        FROM customer_documents cd
        LEFT JOIN users u ON cd.uploaded_by = u.id
        ${whereClause}
        ORDER BY cd.created_at DESC
      `, queryParams);

      return result.rows.map(doc => this.formatDocumentResponse(doc));
    } catch (error) {
      console.error('Error getting customer documents:', error);
      throw error;
    }
  }

  /**
   * Get document by ID
   * @param {string} documentId - Document ID
   * @param {number} customerId - Customer ID for access control
   * @returns {Object} Document object
   */
  async getDocumentById(documentId, customerId = null) {
    try {
      let whereClause = 'WHERE id = $1';
      const queryParams = [documentId];

      if (customerId) {
        whereClause += ' AND customer_id = $2';
        queryParams.push(customerId);
      }

      const result = await query(`
        SELECT 
          cd.*,
          u.first_name as uploaded_by_first_name,
          u.last_name as uploaded_by_last_name,
          c.first_name as customer_first_name,
          c.last_name as customer_last_name,
          c.customer_id as customer_code
        FROM customer_documents cd
        LEFT JOIN users u ON cd.uploaded_by = u.id
        LEFT JOIN customers c ON cd.customer_id = c.id
        ${whereClause}
      `, queryParams);

      if (result.rows.length === 0) {
        throw new Error('Document not found');
      }

      return this.formatDocumentResponse(result.rows[0]);
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }

  /**
   * Update document status and metadata
   * @param {string} documentId - Document ID
   * @param {Object} updateData - Data to update
   * @param {number} updatedBy - User ID updating the document
   * @returns {Object} Updated document
   */
  async updateDocument(documentId, updateData, updatedBy) {
    try {
      return await transaction(async (client) => {
        // Get current document
        const currentDoc = await client.query(
          'SELECT * FROM customer_documents WHERE id = $1',
          [documentId]
        );

        if (currentDoc.rows.length === 0) {
          throw new Error('Document not found');
        }

        const document = currentDoc.rows[0];

        // Build update query
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        if (updateData.status) {
          updateFields.push(`status = $${paramCount}`);
          updateValues.push(updateData.status);
          paramCount++;
        }

        if (updateData.document_type) {
          updateFields.push(`document_type = $${paramCount}`);
          updateValues.push(updateData.document_type);
          paramCount++;
        }

        if (updateData.metadata) {
          const currentMetadata = document.metadata || {};
          const newMetadata = { ...currentMetadata, ...updateData.metadata };
          updateFields.push(`metadata = $${paramCount}`);
          updateValues.push(JSON.stringify(newMetadata));
          paramCount++;
        }

        if (updateFields.length === 0) {
          throw new Error('No valid fields to update');
        }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(documentId);

        const updateQuery = `
          UPDATE customer_documents 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `;

        const result = await client.query(updateQuery, updateValues);
        const updatedDocument = result.rows[0];

        // Log document update
        await this.logDocumentActivity(client, documentId, updatedBy, 'document_updated', {
          updated_fields: Object.keys(updateData),
          changes: updateData
        });

        return this.formatDocumentResponse(updatedDocument);
      });
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }

  /**
   * Delete a document
   * @param {string} documentId - Document ID
   * @param {number} deletedBy - User ID deleting the document
   * @returns {boolean} Success status
   */
  async deleteDocument(documentId, deletedBy) {
    try {
      return await transaction(async (client) => {
        // Get document details
        const docResult = await client.query(
          'SELECT * FROM customer_documents WHERE id = $1',
          [documentId]
        );

        if (docResult.rows.length === 0) {
          throw new Error('Document not found');
        }

        const document = docResult.rows[0];

        // Delete physical files
        const absolutePath = path.join(this.uploadDir, document.file_path);
        try {
          await fs.unlink(absolutePath);
        } catch (error) {
          console.warn('Could not delete file:', absolutePath);
        }

        // Delete thumbnail if exists
        if (document.thumbnail_path) {
          const thumbnailAbsolutePath = path.join(this.uploadDir, document.thumbnail_path);
          try {
            await fs.unlink(thumbnailAbsolutePath);
          } catch (error) {
            console.warn('Could not delete thumbnail:', thumbnailAbsolutePath);
          }
        }

        // Delete database record
        await client.query('DELETE FROM customer_documents WHERE id = $1', [documentId]);

        // Log document deletion
        await this.logDocumentActivity(client, documentId, deletedBy, 'document_deleted', {
          filename: document.original_name,
          document_type: document.document_type
        });

        return true;
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Get document file stream for download
   * @param {string} documentId - Document ID
   * @param {boolean} thumbnail - Whether to get thumbnail
   * @returns {Object} File stream and metadata
   */
  async getDocumentStream(documentId, thumbnail = false) {
    try {
      const document = await this.getDocumentById(documentId);
      
      const filePath = thumbnail && document.thumbnail_path 
        ? document.thumbnail_path 
        : document.file_path;
      
      const absolutePath = path.join(this.uploadDir, filePath);
      
      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch (error) {
        throw new Error('File not found on disk');
      }

      return {
        filePath: absolutePath,
        filename: thumbnail ? `thumb_${document.filename}` : document.filename,
        mimetype: document.mime_type,
        size: document.file_size
      };
    } catch (error) {
      console.error('Error getting document stream:', error);
      throw error;
    }
  }

  /**
   * Validate uploaded file
   * @param {Object} file - Uploaded file object
   */
  async validateFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    if (!this.allowedTypes[file.mimetype]) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }

    if (file.size > this.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize} bytes`);
    }

    // Additional validation for specific file types
    if (file.mimetype === 'application/pdf') {
      await this.validatePDF(file.buffer);
    }

    if (file.mimetype.startsWith('image/')) {
      await this.validateImage(file.buffer);
    }
  }

  /**
   * Validate PDF file
   * @param {Buffer} buffer - File buffer
   */
  async validatePDF(buffer) {
    // Check PDF header
    const pdfHeader = buffer.slice(0, 4).toString('ascii');
    if (pdfHeader !== '%PDF') {
      throw new Error('Invalid PDF file');
    }
  }

  /**
   * Validate image file
   * @param {Buffer} buffer - File buffer
   */
  async validateImage(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image file');
      }
    } catch (error) {
      throw new Error('Invalid image file');
    }
  }

  /**
   * Process and save file to disk
   * @param {Object} file - File object
   * @param {string} absolutePath - Absolute path to save file
   */
  async processAndSaveFile(file, absolutePath) {
    try {
      if (file.mimetype.startsWith('image/')) {
        // Process image: resize if too large, optimize
        await sharp(file.buffer)
          .resize(2048, 2048, { 
            fit: 'inside', 
            withoutEnlargement: true 
          })
          .jpeg({ quality: 85 })
          .toFile(absolutePath);
      } else {
        // Save non-image files as-is
        await fs.writeFile(absolutePath, file.buffer);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      throw new Error('Failed to process and save file');
    }
  }

  /**
   * Generate thumbnail for image
   * @param {string} originalPath - Path to original image
   * @param {number} customerId - Customer ID
   * @param {string} fileId - File ID
   * @returns {string} Thumbnail path
   */
  async generateThumbnail(originalPath, customerId, fileId) {
    try {
      const thumbnailDir = path.join(this.uploadDir, 'customers', customerId.toString(), 'thumbnails');
      await fs.mkdir(thumbnailDir, { recursive: true });

      const thumbnailPath = path.join(thumbnailDir, `${fileId}_thumb.jpg`);
      const relativeThumbnailPath = `customers/${customerId}/thumbnails/${fileId}_thumb.jpg`;

      await sharp(originalPath)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      return relativeThumbnailPath;
    } catch (error) {
      console.warn('Could not generate thumbnail:', error);
      return null;
    }
  }

  /**
   * Calculate file hash for integrity checking
   * @param {Buffer} buffer - File buffer
   * @returns {string} File hash
   */
  async calculateFileHash(buffer) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Ensure upload directories exist
   * @param {number} customerId - Customer ID
   */
  async ensureDirectoriesExist(customerId) {
    const customerDir = path.join(this.uploadDir, 'customers', customerId.toString());
    const thumbnailDir = path.join(customerDir, 'thumbnails');
    
    await fs.mkdir(customerDir, { recursive: true });
    await fs.mkdir(thumbnailDir, { recursive: true });
  }

  /**
   * Infer document type from filename
   * @param {string} filename - Original filename
   * @returns {string} Document type
   */
  inferDocumentType(filename) {
    const lowerFilename = filename.toLowerCase();
    
    if (lowerFilename.includes('nic') || lowerFilename.includes('national')) {
      return lowerFilename.includes('back') ? 'nic_back' : 'nic_front';
    }
    if (lowerFilename.includes('passport')) {return 'passport';}
    if (lowerFilename.includes('license')) {return 'driving_license';}
    if (lowerFilename.includes('birth')) {return 'birth_certificate';}
    if (lowerFilename.includes('utility') || lowerFilename.includes('bill')) {return 'utility_bill';}
    if (lowerFilename.includes('bank') || lowerFilename.includes('statement')) {return 'bank_statement';}
    if (lowerFilename.includes('salary') || lowerFilename.includes('pay')) {return 'salary_slip';}
    if (lowerFilename.includes('employment') || lowerFilename.includes('work')) {return 'employment_letter';}
    if (lowerFilename.includes('business') || lowerFilename.includes('registration')) {return 'business_registration';}
    if (lowerFilename.includes('tax')) {return 'tax_return';}
    
    return 'other';
  }

  /**
   * Format document response
   * @param {Object} document - Raw document data
   * @returns {Object} Formatted document data
   */
  formatDocumentResponse(document) {
    return {
      id: document.id,
      file_id: document.file_id,
      original_name: document.original_name,
      filename: document.filename,
      file_size: document.file_size,
      mime_type: document.mime_type,
      document_type: document.document_type,
      document_type_display: this.documentTypes[document.document_type] || document.document_type,
      status: document.status,
      file_hash: document.file_hash,
      has_thumbnail: !!document.thumbnail_path,
      uploaded_by: document.uploaded_by_first_name && document.uploaded_by_last_name
        ? `${document.uploaded_by_first_name} ${document.uploaded_by_last_name}`
        : null,
      customer: document.customer_first_name && document.customer_last_name
        ? {
            name: `${document.customer_first_name} ${document.customer_last_name}`,
            customer_id: document.customer_code
          }
        : null,
      metadata: document.metadata ? JSON.parse(document.metadata) : {},
      created_at: document.created_at,
      updated_at: document.updated_at
    };
  }

  /**
   * Log document activity
   * @param {Object} client - Database client
   * @param {string} documentId - Document ID
   * @param {number} userId - User ID
   * @param {string} action - Action performed
   * @param {Object} details - Additional details
   */
  async logDocumentActivity(client, documentId, userId, action, details) {
    await client.query(`
      INSERT INTO audit_logs (user_id, action, resource, resource_id, details, success)
      VALUES ($1, $2, 'document', $3, $4, true)
    `, [userId, action, documentId.toString(), JSON.stringify(details)]);
  }

  /**
   * Get allowed document types
   * @returns {Object} Document types with display names
   */
  getDocumentTypes() {
    return this.documentTypes;
  }

  /**
   * Get allowed file types
   * @returns {Object} Allowed MIME types with extensions
   */
  getAllowedFileTypes() {
    return this.allowedTypes;
  }
}

module.exports = new DocumentService();