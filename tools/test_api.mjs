import fetch from 'node-fetch';

async function testUpload() {
    console.log('Testing local /api/drive_upload...');
    try {
        const response = await fetch('http://localhost:5173/api/drive_upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file: 'YmFzZTY0dGVzdA==', // "base64test"
                fileName: 'test.txt',
                fileType: 'text/plain'
            })
        });

        const status = response.status;
        console.log('Status:', status);

        const text = await response.text();
        console.log('Response Body:', text);
    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

testUpload();
