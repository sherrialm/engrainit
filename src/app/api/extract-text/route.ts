import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/extract-text
 * 
 * Extracts text from uploaded documents (PDF, DOCX, TXT)
 */
export async function POST(request: NextRequest) {
    try {
        console.log('Extract-text API called');

        const formData = await request.formData();
        const file = formData.get('file') as File;

        console.log('File received:', file ? { name: file.name, size: file.size, type: file.type } : 'null');

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided', code: 'MISSING_FILE' },
                { status: 400 }
            );
        }

        const fileName = file.name.toLowerCase();
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log('Processing file:', fileName, 'Buffer size:', buffer.length);

        let extractedText = '';

        // Handle different file types
        if (fileName.endsWith('.txt')) {
            extractedText = new TextDecoder().decode(buffer);
        } else if (fileName.endsWith('.pdf')) {
            const pdfParse = require('pdf-parse');
            const pdfData = await pdfParse(buffer);
            extractedText = pdfData.text;
        } else if (fileName.endsWith('.docx')) {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value;
        } else if (fileName.endsWith('.doc')) {
            return NextResponse.json(
                { error: 'Legacy .doc format not supported. Please convert to .docx', code: 'UNSUPPORTED_FORMAT' },
                { status: 400 }
            );
        } else {
            return NextResponse.json(
                { error: 'Unsupported file format. Use PDF, DOCX, or TXT', code: 'UNSUPPORTED_FORMAT' },
                { status: 400 }
            );
        }

        // Clean up the extracted text
        extractedText = extractedText
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        // Limit text length for TTS (can be chunked later)
        const maxLength = 5000;
        if (extractedText.length > maxLength) {
            extractedText = extractedText.substring(0, maxLength);
        }

        return NextResponse.json({
            text: extractedText,
            fileName: file.name,
            characterCount: extractedText.length,
            truncated: extractedText.length >= maxLength,
        });
    } catch (error: any) {
        console.error('Text extraction error:', error);
        return NextResponse.json(
            { error: 'Failed to extract text from document', code: 'EXTRACTION_ERROR' },
            { status: 500 }
        );
    }
}
