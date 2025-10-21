# Upload Directory

This directory contains uploaded customer documents and files.

## Structure

```
uploads/
├── customers/
│   ├── {customer_id}/
│   │   ├── documents/
│   │   └── thumbnails/
└── temp/
```

## Security

- All files are validated before upload
- File types are restricted to allowed MIME types
- File sizes are limited to prevent abuse
- Access is controlled through authentication and authorization
- Files are stored with UUID names to prevent direct access

## File Types Allowed

- Images: JPEG, PNG, GIF
- Documents: PDF, DOC, DOCX
- Maximum file size: 10MB per file
- Maximum files per upload: 10

## Access Control

- Only authenticated users with customer management permissions can upload/download
- Branch-level access control applies
- All file operations are logged for audit trail