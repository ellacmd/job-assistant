declare module 'pdf-parse' {
    interface PDFParseOptions {
        version?: string;
    }
    interface PDFParseResult {
        numpages: number;
        numrender: number;
        info: unknown;
        metadata: unknown;
        text: string;
        version: string;
    }
    function pdfParse(
        buffer: Buffer | Uint8Array,
        options?: PDFParseOptions
    ): Promise<PDFParseResult>;
    export = pdfParse;
}
