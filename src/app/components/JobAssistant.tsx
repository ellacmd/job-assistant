'use client';

import { useState, useRef, useEffect } from 'react';
import mammoth from 'mammoth';
import type { Html2PdfInstance } from 'html2pdf.js';

interface Application {
    id: string;
    jobDescription: string;
    cv: string;
    coverLetter: string;
    fitScore: number;
    tone: string;
    length: string;
    date: string;
}

export default function JobAssistant() {
    const [jobDescription, setJobDescription] = useState('');
    const [cv, setCv] = useState('');
    const [tone, setTone] = useState('Professional');
    const [length, setLength] = useState('Medium');
    const [applications, setApplications] = useState<Application[]>([]);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);
    const [streamingCoverLetter, setStreamingCoverLetter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedApp, setSelectedApp] = useState<Application | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('applications');
        if (stored) {
            setApplications(JSON.parse(stored));
        }
    }, []);

    const handleFileUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        setError(null);
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            if (file.type === 'application/pdf') {
                setError(
                    'PDF upload is temporarily disabled. Please paste your CV directly.'
                );
            } else if (
                file.type ===
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                setCv(result.value);
            } else {
                setError(
                    'Please upload a DOCX file or paste your CV directly.'
                );
            }
        } catch (error) {
            console.error('File processing error:', error);
            setError(
                'Unable to process file. Please try pasting your CV directly.'
            );
        }
    };

    const generateCoverLetter = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setStreamingCoverLetter('');
        setLoading(true);

        if (!jobDescription.trim() || !cv.trim()) {
            setError('Please provide both job description and CV');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobDescription,
                    resume: cv,
                    tone,
                    length,
                }),
            });

            if (!response.body) throw new Error('No response body');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let coverLetter = '';
            let done = false;
            let fitScore = 0;
            const fitScoreHeader = response.headers.get('x-fit-score');
            if (fitScoreHeader) {
                const parsed = parseInt(fitScoreHeader, 10);
                if (!isNaN(parsed)) fitScore = parsed;
            }
            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                if (value) {
                    const chunkStr = decoder.decode(value);
                    for (const line of chunkStr.split('\n')) {
                        if (!line.trim()) continue;
                        try {
                            const json = JSON.parse(line);
                            const content = json.choices?.[0]?.delta?.content;
                            if (content) {
                                coverLetter += content;
                                setStreamingCoverLetter(
                                    (prev) => prev + content
                                );
                            }
                        } catch {
                            // Ignore lines that are not valid JSON
                        }
                    }
                }
            }

            if (coverLetter) {
                const newApplication: Application = {
                    id: Date.now().toString(),
                    jobDescription,
                    cv,
                    coverLetter,
                    fitScore,
                    tone,
                    length,
                    date: new Date().toISOString(),
                };
                const updatedApplications = [newApplication, ...applications];
                setApplications(updatedApplications);
                localStorage.setItem(
                    'applications',
                    JSON.stringify(updatedApplications)
                );
                setStreamingCoverLetter(coverLetter);
            }
        } catch (error) {
            console.error('Error generating cover letter:', error);
            setError('Error generating cover letter. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const exportToPDF = async (content: string) => {
        try {
            const html2pdf = (await import('html2pdf.js')).default;

            const element = document.createElement('div');
            element.innerHTML = `
                <div style="
                    font-family: 'Times New Roman', Times, serif;
                    max-width: 700px;
                    margin: 0 auto;
                    padding: 80px 32px 80px 32px;
                    background: #fff;
                    color: #222;
                    font-size: 1.1rem;
                    line-height: 1.7;
                    border-radius: 8px;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
                ">
                    <div style="margin-bottom: 2.5rem; text-align: right;">
                        <span style="font-size: 1.1rem;">${new Date().toLocaleDateString()}</span>
                    </div>
                    <div style="white-space: pre-wrap;">${content}</div>
                </div>
            `;

            const opt = {
                margin: 0,
                filename: 'cover-letter.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: {
                    unit: 'pt',
                    format: 'letter',
                    orientation: 'portrait',
                },
            };

            const instance = html2pdf() as unknown as Html2PdfInstance;
            await instance.set(opt).from(element).save();
        } catch (error) {
            console.error('Error exporting to PDF:', error);
            setError('Error exporting to PDF. Please try again.');
        }
    };

    return (
        <div className='max-w-4xl mx-auto p-6'>
            <h1 className='text-3xl font-bold mb-8'>
                Job Application Assistant
            </h1>
            <form onSubmit={generateCoverLetter} className='space-y-6'>
                <div>
                    <label className='block text-sm font-medium mb-2'>
                        Job Description
                    </label>
                    <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        className='w-full h-40 p-3 border rounded-lg'
                        placeholder='Paste the job description here...'
                    />
                </div>

                <div>
                    <label className='block text-sm font-medium mb-2'>CV</label>
                    <div className='flex gap-4'>
                        <input
                            type='file'
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept='.docx'
                            className='hidden'
                        />
                        <button
                            type='button'
                            onClick={() => fileInputRef.current?.click()}
                            className='px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300'>
                            Upload CV
                        </button>
                        <textarea
                            value={cv}
                            onChange={(e) => {
                                setCv(e.target.value);
                                setError(null);
                            }}
                            className='flex-1 h-40 p-3 border rounded-lg'
                            placeholder='Paste your CV here...'
                        />
                    </div>
                    {error && (
                        <p className='mt-2 text-sm text-red-600'>{error}</p>
                    )}
                </div>

                <div className='flex gap-4'>
                    <div>
                        <label className='block text-sm font-medium mb-2'>
                            Tone
                        </label>
                        <select
                            value={tone}
                            onChange={(e) => setTone(e.target.value)}
                            className='p-2 border rounded-lg'>
                            <option>Professional</option>
                            <option>Friendly</option>
                            <option>Concise</option>
                        </select>
                    </div>

                    <div>
                        <label className='block text-sm font-medium mb-2'>
                            Length
                        </label>
                        <select
                            value={length}
                            onChange={(e) => setLength(e.target.value)}
                            className='p-2 border rounded-lg'>
                            <option>Short</option>
                            <option>Medium</option>
                            <option>Long</option>
                        </select>
                    </div>
                </div>

                <button
                    type='submit'
                    disabled={loading || !jobDescription.trim() || !cv.trim()}
                    className='w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400'>
                    {loading ? 'Generating...' : 'Generate Cover Letter'}
                </button>
            </form>

            {/* Add a Clear Form button below the form */}
            <button
                type='button'
                onClick={() => {
                    setJobDescription('');
                    setCv('');
                    setTone('Professional');
                    setLength('Medium');
                }}
                className='mt-2 mb-4 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300'>
                Clear Form
            </button>

            {/* Streaming or last generated cover letter output */}
            {(loading || streamingCoverLetter) && (
                <div
                    className={`mt-6 p-4 rounded-lg whitespace-pre-wrap border ${
                        loading ? 'bg-gray-50' : 'bg-green-50'
                    }`}>
                    <h3 className='font-bold mb-2'>
                        {loading
                            ? 'Generating Cover Letter...'
                            : 'Generated Cover Letter'}
                    </h3>
                    <div>{streamingCoverLetter}</div>
                    {!loading && streamingCoverLetter && (
                        <button
                            onClick={() => exportToPDF(streamingCoverLetter)}
                            className='mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700'>
                            Export as PDF
                        </button>
                    )}
                </div>
            )}

            {/* Recent Applications List (latest 5) */}
            {applications.length > 0 && (
                <div className='mt-8'>
                    <h2 className='text-2xl font-bold mb-4'>
                        Recent Applications
                    </h2>
                    <ul className='space-y-2'>
                        {applications.slice(0, 5).map((app) => (
                            <li
                                key={app.id}
                                className='border rounded-lg p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition'
                                onClick={() => {
                                    setSelectedApp(app);
                                    setShowModal(true);
                                }}>
                                <div>
                                    <div className='font-medium'>
                                        Job Description
                                    </div>
                                    <div className='text-sm text-gray-600'>
                                        {app.jobDescription.substring(0, 60)}...
                                    </div>
                                </div>
                                <div className='text-right'>
                                    <div className='font-medium'>Fit Score</div>
                                    <div className='text-lg font-bold text-blue-600'>
                                        {app.fitScore}%
                                    </div>
                                    <div className='text-xs text-gray-400 mt-1'>
                                        {new Date(
                                            app.date
                                        ).toLocaleDateString()}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Modal for full application details */}
            {showModal && selectedApp && (
                <div
                    className='fixed inset-0 z-50 flex items-center justify-center  bg-opacity-5 backdrop-blur-sm'
                    onClick={() => setShowModal(false)}
                    tabIndex={-1}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setShowModal(false);
                    }}>
                    <div
                        className='bg-white rounded-lg p-8 max-w-lg w-full relative shadow-lg overflow-y-auto max-h-[90vh]'
                        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}
                        onClick={(e) => e.stopPropagation()}>
                        <button
                            className='fixed top-6 right-6 text-gray-700 hover:text-gray-900 text-3xl bg-white rounded-full border border-gray-200 w-10 h-10 flex items-center justify-center shadow-lg z-50'
                            onClick={() => setShowModal(false)}
                            aria-label='Close'>
                            &times;
                        </button>
                        <h3 className='text-xl font-bold mb-2'>Cover Letter</h3>
                        <div className='mb-4 whitespace-pre-wrap'>
                            {selectedApp.coverLetter}
                        </div>
                        <div className='flex flex-col sm:flex-row sm:items-center gap-2 mb-4'>
                            <div>
                                <span className='font-medium'>Fit Score:</span>{' '}
                                <span className='text-blue-600 font-bold'>
                                    {selectedApp.fitScore}%
                                </span>
                            </div>
                            <button
                                onClick={() =>
                                    exportToPDF(selectedApp.coverLetter)
                                }
                                className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700'>
                                Export as PDF
                            </button>
                        </div>
                        <h4 className='font-semibold'>Job Description</h4>
                        <div className='mb-2 text-sm text-gray-700 whitespace-pre-wrap'>
                            {selectedApp.jobDescription}
                        </div>
                        <h4 className='font-semibold'>CV</h4>
                        <div className='mb-2 text-sm text-gray-700 whitespace-pre-wrap'>
                            {selectedApp.cv}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
