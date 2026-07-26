const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../app');

// Uploads are buffered into memory, so an unbounded multer config lets one
// authenticated user OOM the server for everyone. These routes previously had
// no size cap and no type filter at all.
describe('Upload limits', () => {
  const token = jwt.sign(
    { id: new mongoose.Types.ObjectId().toString(), email: 'u@example.com', role: 'student' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const pdf = (mb) => Buffer.alloc(mb * 1024 * 1024, 'a');

  test('marks upload rejects a PDF over the 10MB cap', async () => {
    const res = await request(app)
      .post('/api/marks/upload-pdf')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', pdf(11), 'big.pdf');

    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/too large/i);
  });

  test('marks upload rejects a non-PDF file type', async () => {
    const res = await request(app)
      .post('/api/marks/upload-pdf')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('#!/bin/sh\necho hi'), 'payload.sh');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only pdf/i);
  });

  test('parse-pdfs rejects more than 20 files', async () => {
    const req = request(app)
      .post('/api/marks/parse-pdfs')
      .set('Authorization', `Bearer ${token}`);

    for (let i = 0; i < 21; i++) req.attach('files', pdf(1), `f${i}.pdf`);

    const res = await req;
    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/too many/i);
  });

  test('resume upload rejects a file over the 5MB cap', async () => {
    const res = await request(app)
      .post('/api/career/upload-resume')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', pdf(6), 'resume.pdf');

    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/too large/i);
  });

  test('resume upload rejects a disallowed file type', async () => {
    const res = await request(app)
      .post('/api/career/upload-resume')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('binary'), 'malware.exe');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only pdf and image/i);
  });

  test('a PDF within the cap passes the upload layer', async () => {
    const res = await request(app)
      .post('/api/marks/upload-pdf')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', pdf(1), 'ok.pdf');

    // Parsing a buffer of 'a' fails downstream — the point is that multer
    // accepted it rather than rejecting on size or type.
    expect([413, 400]).not.toContain(res.status);
  });
});
