const express = require('express');
const Joi = require('joi');
const documentService = require('../services/documentService');
const { 
  authenticateToken, 
  requirePermission,
  auditLog,
  rateLimitByUser
} = require('../middleware/auth');

const router = express.Router();

// Configure multer middleware
const upload = documentService.getUploadMiddleware();

// Validation schemas
const uploadMetadataSchema = Joi.object({
  document_type: Joi.string().valid(
    'nic_front', 'nic_back', 'passport', 'driving_license', 'birth_certificate',
    'utility_bill', 'bank_statement', 'salary_slip', 'employment_letter',
    'business_registration', 'tax_return', 'other'
  ).optional(),
  description: Joi.string().max(500).optional(),
  category: Joi.string().max(100).optional()
});

const updateDocumentSchema = Joi.object({
  status: Joi.string().valid('uploaded', 'verified', 'rejected', 'archived').optional(),
  document_type: Joi.string().valid(
    'nic_front', 'nic_back', 'passport', 'driving_license', 'birth_certificate',
    'utility_bill', 'bank_statement', 'salary_slip', 'employment_letter',
    'business_registration', 'tax_return', 'other'
  ).optional(),
  metadata: Joi.object().optional()
});

// @route   POST /api/documents/upload/:customerId
// @desc    Upload documents for a customer
// @access  Private (Customer Management - Create)
router.post('/upload/:customerId',
  authenticateToken,
  requirePermission('customer_management', 'create'),
  rateLimitByUser(20, 60 * 60 * 1000), // 20 uploads per hour
  upload.array('documents', 10), // Max 10 files
  auditLog('document_upload', 'customer_management'),
  async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      
      if (isNaN(customerId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid customer ID',
          code: 'INVALID_CUSTOMER_ID'
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded',
          code: 'NO_FILES_UPLOADED'
        });
      }

      // Validate metadata if provided
      let metadata = {};
      if (req.body.metadata) {
        try {
          metadata = JSON.parse(req.body.metadata);
          const { error } = uploadMetadataSchema.validate(metadata);
          if (error) {
            return res.status(400).json({
              success: false,
              error: error.details[0].message,
              code: 'VALIDATION_ERROR'
            });
          }
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: 'Invalid metadata format',
            code: 'INVALID_METADATA'
          });
        }
      }

      // Check if customer exists and user has access
      // This would be done through customerService in real implementation
      // For now, we'll trust the customer ID

      const uploadedDocuments = await documentService.uploadDocuments(
        customerId,
        req.files,
        req.user.id,
        metadata
      );

      res.status(201).json({
        success: true,
        message: `${uploadedDocuments.length} document(s) uploaded successfully`,
        data: {
          documents: uploadedDocuments,
          count: uploadedDocuments.length
        }
      });

    } catch (error) {
      console.error('Upload documents error:', error);
      
      if (error.message.includes('File type') || error.message.includes('File size')) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'FILE_VALIDATION_ERROR'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to upload documents',
        code: 'DOCUMENT_UPLOAD_FAILED'
      });
    }
  }
);

// @route   GET /api/documents/customer/:customerId
// @desc    Get all documents for a customer
// @access  Private (Customer Management - Read)
router.get('/customer/:customerId',
  authenticateToken,
  requirePermission('customer_management', 'read'),
  rateLimitByUser(100, 60 * 60 * 1000), // 100 requests per hour
  async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      
      if (isNaN(customerId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid customer ID',
          code: 'INVALID_CUSTOMER_ID'
        });
      }

      // Parse filters from query
      const filters = {
        document_type: req.query.document_type,
        status: req.query.status
      };

      const documents = await documentService.getCustomerDocuments(customerId, filters);

      res.json({
        success: true,
        data: {
          documents,
          count: documents.length
        }
      });

    } catch (error) {
      console.error('Get customer documents error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to get customer documents',
        code: 'GET_DOCUMENTS_FAILED'
      });
    }
  }
);

// @route   GET /api/documents/:documentId
// @desc    Get document by ID
// @access  Private (Customer Management - Read)
router.get('/:documentId',
  authenticateToken,
  requirePermission('customer_management', 'read'),
  rateLimitByUser(200, 60 * 60 * 1000), // 200 requests per hour
  async (req, res) => {
    try {
      const documentId = req.params.documentId;

      const document = await documentService.getDocumentById(documentId);

      res.json({
        success: true,
        data: { document }
      });

    } catch (error) {
      console.error('Get document error:', error);
      
      if (error.message === 'Document not found') {
        return res.status(404).json({
          success: false,
          error: 'Document not found',
          code: 'DOCUMENT_NOT_FOUND'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to get document',
        code: 'GET_DOCUMENT_FAILED'
      });
    }
  }
);

// @route   PUT /api/documents/:documentId
// @desc    Update document metadata and status
// @access  Private (Customer Management - Update)
router.put('/:documentId',
  authenticateToken,
  requirePermission('customer_management', 'update'),
  rateLimitByUser(50, 60 * 60 * 1000), // 50 updates per hour
  async (req, res) => {
    try {
      const documentId = req.params.documentId;

      // Validate update data
      const { error, value } = updateDocumentSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
      }

      const updatedDocument = await documentService.updateDocument(
        documentId,
        value,
        req.user.id
      );

      res.json({
        success: true,
        message: 'Document updated successfully',
        data: { document: updatedDocument }
      });

    } catch (error) {
      console.error('Update document error:', error);
      
      if (error.message === 'Document not found') {
        return res.status(404).json({
          success: false,
          error: 'Document not found',
          code: 'DOCUMENT_NOT_FOUND'
        });
      }

      if (error.message === 'No valid fields to update') {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'NO_UPDATE_FIELDS'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update document',
        code: 'DOCUMENT_UPDATE_FAILED'
      });
    }
  }
);

// @route   DELETE /api/documents/:documentId
// @desc    Delete a document
// @access  Private (Customer Management - Delete)
router.delete('/:documentId',
  authenticateToken,
  requirePermission('customer_management', 'delete'),
  rateLimitByUser(20, 60 * 60 * 1000), // 20 deletes per hour
  auditLog('document_delete', 'customer_management'),
  async (req, res) => {
    try {
      const documentId = req.params.documentId;

      const success = await documentService.deleteDocument(documentId, req.user.id);

      if (success) {
        res.json({
          success: true,
          message: 'Document deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to delete document',
          code: 'DOCUMENT_DELETE_FAILED'
        });
      }

    } catch (error) {
      console.error('Delete document error:', error);
      
      if (error.message === 'Document not found') {
        return res.status(404).json({
          success: false,
          error: 'Document not found',
          code: 'DOCUMENT_NOT_FOUND'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete document',
        code: 'DOCUMENT_DELETE_FAILED'
      });
    }
  }
);

// @route   GET /api/documents/:documentId/download
// @desc    Download a document file
// @access  Private (Customer Management - Read)
router.get('/:documentId/download',
  authenticateToken,
  requirePermission('customer_management', 'read'),
  rateLimitByUser(100, 60 * 60 * 1000), // 100 downloads per hour
  async (req, res) => {
    try {
      const documentId = req.params.documentId;
      const thumbnail = req.query.thumbnail === 'true';

      const fileInfo = await documentService.getDocumentStream(documentId, thumbnail);

      res.setHeader('Content-Type', fileInfo.mimetype);
      res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.filename}"`);
      res.setHeader('Content-Length', fileInfo.size);

      // Stream the file
      const fs = require('fs');
      const fileStream = fs.createReadStream(fileInfo.filePath);
      
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to stream file',
            code: 'FILE_STREAM_ERROR'
          });
        }
      });

    } catch (error) {
      console.error('Download document error:', error);
      
      if (error.message === 'Document not found') {
        return res.status(404).json({
          success: false,
          error: 'Document not found',
          code: 'DOCUMENT_NOT_FOUND'
        });
      }

      if (error.message === 'File not found on disk') {
        return res.status(404).json({
          success: false,
          error: 'File not found',
          code: 'FILE_NOT_FOUND'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to download document',
        code: 'DOCUMENT_DOWNLOAD_FAILED'
      });
    }
  }
);

// @route   GET /api/documents/types
// @desc    Get available document types
// @access  Private
router.get('/types',
  authenticateToken,
  async (req, res) => {
    try {
      const documentTypes = documentService.getDocumentTypes();
      const allowedFileTypes = documentService.getAllowedFileTypes();

      res.json({
        success: true,
        data: {
          document_types: documentTypes,
          allowed_file_types: allowedFileTypes,
          max_file_size: parseInt(process.env.MAX_FILE_SIZE) || 10485760,
          max_files_per_upload: 10
        }
      });

    } catch (error) {
      console.error('Get document types error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to get document types',
        code: 'GET_TYPES_FAILED'
      });
    }
  }
);

module.exports = router;