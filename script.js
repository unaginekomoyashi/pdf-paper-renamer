const dropZone = document.getElementById('drop-zone');
const fileList = document.getElementById('file-list');
const resultDiv = document.getElementById('result');

dropZone.addEventListener('dragover', (event) => {
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', (event) => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (event) => {
    event.stopPropagation();
    event.preventDefault();
    dropZone.classList.remove('dragover');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        resultDiv.classList.add('show');
        handleFiles(files);
    }
});

async function handleFiles(files) {
    for (const file of files) {
        if (file.type === 'application/pdf') {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span class="file-name">処理中: ${file.name}</span>
                <div class="progress"><div class="progress-bar"></div></div>
            `;
            fileList.appendChild(listItem);
            const progressBar = listItem.querySelector('.progress-bar');

            try {
                const title = await extractTitleFromPdf(file, (progress) => {
                    progressBar.style.width = `${progress * 100}%`;
                });
                const sanitizedTitle = sanitizeFilename(title || 'untitled');
                const newFileName = `${sanitizedTitle}.pdf`;

                const downloadLink = document.createElement('a');
                downloadLink.href = URL.createObjectURL(file);
                downloadLink.download = newFileName;
                downloadLink.textContent = 'ダウンロード';
                downloadLink.classList.add('download-link');

                listItem.innerHTML = `
                    <span class="file-name">元ファイル: ${file.name}<br>新ファイル名: ${newFileName}</span>
                `;
                listItem.appendChild(downloadLink);

            } catch (error) {
                console.error('Error processing file:', file.name, error);
                listItem.innerHTML = `<span class="file-name">エラー: ${file.name} - ${error.message}</span>`;
                listItem.style.color = 'red';
            }
        } else {
            const listItem = document.createElement('li');
            listItem.textContent = `スキップ: ${file.name} (PDFファイルではありません)`;
            listItem.style.color = 'gray';
            fileList.appendChild(listItem);
        }
    }
}

async function extractTitleFromPdf(file, onProgress) {
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
        fileReader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            try {
                const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
                if (onProgress) onProgress(0.3); // 30% progress after loading

                const page = await pdf.getPage(1); // Get the first page
                if (onProgress) onProgress(0.6); // 60% progress after getting page

                const textContent = await page.getTextContent();
                if (onProgress) onProgress(0.9); // 90% progress after getting text content

                // Simple title extraction: Join first few lines of text items
                // More sophisticated logic could analyze font size, position, etc.
                let potentialTitle = '';
                const maxLines = 5; // Consider first 5 text items as potential title parts
                for (let i = 0; i < Math.min(textContent.items.length, maxLines); i++) {
                    potentialTitle += textContent.items[i].str + ' ';
                    // Stop if we encounter a significant vertical gap (heuristic for end of title)
                    if (i + 1 < textContent.items.length) {
                        const currentY = textContent.items[i].transform[5];
                        const nextY = textContent.items[i+1].transform[5];
                        if (Math.abs(currentY - nextY) > textContent.items[i].height * 2) { // If gap is > 2x line height
                            break;
                        }
                    }
                }
                potentialTitle = potentialTitle.trim();

                if (onProgress) onProgress(1); // 100% progress
                resolve(potentialTitle);

            } catch (error) {
                reject(error);
            }
        };
        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(file);
    });
}

function sanitizeFilename(name) {
    // Remove invalid characters for filenames and limit length
    return name.replace(/[\/\\?%*:|"<>]/g, '-').substring(0, 100);
}