import multer from 'multer';
import { AppError } from '../utils/errors.js';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.env.PDF_UPLOAD_PATH);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${file.fieldname}-${uniqueSuffix}.pdf`);
    }
});

export const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            cb(new AppError('Only PDF files are allowed', 415));
            return;
        }
        cb(null, true);
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
}).single('bankStatement');