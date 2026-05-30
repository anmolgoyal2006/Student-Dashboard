#!/usr/bin/env python3
"""Use Groq vision API to read handwritten grades from cropped cell images."""

import sys
import json
import os
import base64
import urllib.request
import urllib.error
import time
import re

GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
VALID_GRADES = {'A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'}

def encode_image(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

def read_grade_from_image(image_path):
   
    if not image_path or not os.path.exists(image_path):
        return ''
    
    b64 = encode_image(image_path)
    ext = 'image/png' if image_path.lower().endswith('.png') else 'image/jpeg'
    
    payload = json.dumps({
        'contents': [{
            'parts': [
                {
                    'inline_data': {
                        'mime_type': ext,
                        'data': b64
                    }
                },
                {
                    'text': (
                        'This is a cropped cell from a handwritten university grade sheet.\n'
                        'The cell contains exactly ONE handwritten letter grade.\n'
                        'Valid grades ONLY: A+, A, B+, B, C+, C, D, F\n\n'
                        'Handwriting rules:\n'
                        '- "+" is often written as "t" or "f" in cursive (Bt=B+, Ct=C+, At=A+, Cf=C+)\n'
                        '- Ignore annotations in parentheses like (UMC),(I),(W) — extract base grade only\n'
                        '- If empty or unreadable output: ?\n'
                        'Output ONLY the grade, nothing else. Example: B+ or C or F'
                    )
                }
            ]
        }],
        'generationConfig': {'temperature': 0, 'maxOutputTokens': 10}
    }).encode('utf-8')
    
    req = urllib.request.Request(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'X-goog-api-key': GROQ_API_KEY
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            raw = result['candidates'][0]['content']['parts'][0]['text'].strip()
            return normalize_grade(raw)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        if e.code == 429:
            try:
                retry_delay = json.loads(body).get('error', {}).get('details', [{}])
                wait = 5  # default
                for d in retry_delay:
                    if 'retryDelay' in str(d):
                        wait = float(str(d).split('retryDelay')[1].split("'")[1].replace('s',''))
                        break
            except Exception:
                wait = 5
            wait = min(wait + 0.5, 10)
            sys.stderr.write(f'[Groq] Rate limited, waiting {wait}s...\n')
            time.sleep(wait)
            return read_grade_from_image(image_path)  # retry once
        sys.stderr.write(f'[Groq] Error for {image_path}: {str(e)} | {body}\n')
        return ''
    except Exception as e:
        sys.stderr.write(f'[Groq] Error for {image_path}: {str(e)}\n')
        return ''

def normalize_grade(raw):
    if not raw or raw == '?':
        return ''
    
    text = raw.upper().strip()
    
  # Strip annotations like (UMC)
    text = re.sub(r'\([^)]*\)', '', text).strip()
    text = re.sub(r'\[[^\]]*\]', '', text).strip()
    
    # Cursive t/f at end = +
    text = re.sub(r'^([ABC])[TF]$', r'\1+', text)
    
    # Direct match
    if text in VALID_GRADES:
        return text
    
    # Single letter fallback
    if len(text) == 1 and text in 'ABCDF':
        return text
    
    # First char if valid
    if text and text[0] in 'ABCDF':
        candidate = text[0]
        if len(text) > 1 and text[1] in ('+', 'T', 'F') and candidate in 'ABC':
            candidate += '+'
        if candidate in VALID_GRADES:
            return candidate
    
    return ''


def read_grades_batch(image_paths):
    """Read multiple grade images, return list of grades in same order."""
    results = []
    for path in image_paths:
        grade = read_grade_from_image(path)
        results.append(grade)
    return results


if __name__ == '__main__':
    # Input: JSON array of image paths via stdin
    # Output: JSON array of grades
    try:
        data = json.loads(sys.stdin.read())
        image_paths = data.get('images', [])
        grades = read_grades_batch(image_paths)
        print(json.dumps({'grades': grades}))
    except Exception as e:
        print(json.dumps({'error': str(e), 'grades': []}))
        sys.exit(1)