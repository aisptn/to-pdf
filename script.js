const elements = {
    clear: document.getElementById('clear'),
    open: document.getElementById('open'),
    save: document.getElementById('save'),
    zoomOut: document.getElementById('zoom-out'),
    zoomIn: document.getElementById('zoom-in'),
    zoomLevel: document.getElementById('zoom-level'),
    main: document.querySelector('main'),
    h1: document.querySelector('main h1')
};

let zoom = 0.1;
let files = [];
let objectUrls = [];

const updateDisplay = () => {
    elements.zoomLevel.textContent = `zoom: ${zoom.toFixed(2)}`;
    elements.h1.style.display = files.length ? 'none' : '';
    elements.clear.disabled = elements.save.disabled = !files.length;

    files.forEach(entry => {
        const img = entry.img;
        if (img && img.naturalWidth) {
            img.style.width = `${img.naturalWidth * zoom}px`;
            img.style.height = `${img.naturalHeight * zoom}px`;
        }
    });
};

const handleFiles = async (newFiles) => {
    const exifPromises = [];

    Array.from(newFiles).forEach(file => {
        if (!['image/jpeg', 'image/png'].includes(file.type)) return;

        const fileEntry = {
            file,
            orientation: 1,
            data: null,
            img: null,
            width: 0,
            height: 0
        };
        files.push(fileEntry);

        const figure = document.createElement('figure');
        const img = document.createElement('img');
        fileEntry.img = img;

        const url = URL.createObjectURL(file);
        objectUrls.push(url);
        img.src = url;

        img.onload = () => {
            fileEntry.width = img.naturalWidth;
            fileEntry.height = img.naturalHeight;
            updateDisplay();
        };

        figure.appendChild(img);
        elements.main.appendChild(figure);

        const exifPromise = new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const buffer = e.target.result;
                const bytes = new Uint8Array(buffer);
                fileEntry.data = bytes;

                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }

                const exifObj = piexif.load(binary);
                if (exifObj["0th"] && exifObj["0th"][piexif.ImageIFD.Orientation]) {
                    fileEntry.orientation = exifObj["0th"][piexif.ImageIFD.Orientation];
                }
                resolve();
            };
            reader.readAsArrayBuffer(file);
        });
        exifPromises.push(exifPromise);
    });

    await Promise.all(exifPromises);
};

elements.zoomOut.onclick = () => { zoom = Math.max(0.01, zoom / 1.2); updateDisplay(); };
elements.zoomIn.onclick = () => { zoom = Math.min(2.0, zoom * 1.2); updateDisplay(); };
elements.zoomLevel.onclick = () => { zoom = 0.1; updateDisplay(); };

elements.main.ondragover = (e) => { e.preventDefault(); elements.main.classList.add('drop-hover'); };
elements.main.ondragleave = () => elements.main.classList.remove('drop-hover');
elements.main.ondrop = async (e) => {
    e.preventDefault();
    elements.main.classList.remove('drop-hover');
    await handleFiles(e.dataTransfer.files);
};

elements.open.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png';
    input.multiple = true;
    input.onchange = async () => await handleFiles(input.files);
    input.click();
};

elements.clear.onclick = () => {
    elements.main.querySelectorAll('figure').forEach(f => f.remove());
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    objectUrls = [];
    files = [];
    updateDisplay();
};

const createPdfWorker = () => {
    try {
        return new Worker('pdf-worker.js');
    } catch (error) {
        console.warn('PDF worker initialization failed:', error);
        return null;
    }
};

const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const savePdfOnMainThread = async (entries) => {
    const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!jsPDF) {
        throw new Error('jsPDF unavailable');
    }

    let doc;
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        let w = entry.width;
        let h = entry.height;
        const swapDimensions = entry.orientation >= 5 && entry.orientation <= 8;
        if (swapDimensions) {
            [w, h] = [h, w];
        }

        if (!doc) {
            doc = new jsPDF({
                orientation: w > h ? 'l' : 'p',
                unit: 'px',
                format: [w, h],
                hotfixes: ['px_scaling']
            });
        } else {
            doc.addPage([w, h], w > h ? 'l' : 'p');
        }

        const format = entry.type === 'image/jpeg' ? 'JPEG' : 'PNG';
        const compression = format === 'PNG' ? 'SLOW' : 'NONE';
        const imageData = new Uint8Array(entry.data);
        doc.addImage(imageData, format, 0, 0, w, h, undefined, compression);
        await new Promise(requestAnimationFrame);
    }

    const pdfArrayBuffer = doc.output('arraybuffer');
    downloadBlob(new Blob([pdfArrayBuffer], { type: 'application/pdf' }), 'images.pdf');
};

const sendPdfWorker = (worker, entries) => new Promise((resolve, reject) => {
    worker.onmessage = (event) => {
        if (event.data.type === 'success') {
            resolve(event.data.pdf);
        } else {
            reject(new Error(event.data.message || 'PDF worker failed')); 
        }
    };
    worker.onerror = (error) => reject(error);
    const transfer = entries.map(entry => entry.data);
    worker.postMessage({ entries }, transfer);
});

const preparePdfEntries = async () => {
    return Promise.all(files.map(async (entry) => {
        if (!entry.data) {
            const buffer = await entry.file.arrayBuffer();
            entry.data = new Uint8Array(buffer);
        }

        return {
            type: entry.file.type,
            orientation: entry.orientation,
            width: entry.width || entry.img?.naturalWidth || 0,
            height: entry.height || entry.img?.naturalHeight || 0,
            data: entry.data.buffer
        };
    }));
};

elements.save.onclick = async () => {
    if (!files.length) return;

    const originalText = elements.save.textContent;
    elements.save.disabled = true;
    elements.save.textContent = 'saving...';

    try {
        const entries = await preparePdfEntries();
        const worker = createPdfWorker();

        if (worker) {
            try {
                const pdfBuffer = await sendPdfWorker(worker, entries);
                downloadBlob(new Blob([pdfBuffer], { type: 'application/pdf' }), 'images.pdf');
            } catch (error) {
                console.warn('Worker PDF generation failed, falling back to main thread:', error);
                await savePdfOnMainThread(entries);
            } finally {
                worker.terminate();
            }
        } else {
            await savePdfOnMainThread(entries);
        }
    } catch (error) {
        console.error('Save PDF failed:', error);
        alert(`Could not generate PDF: ${error.message}`);
    } finally {
        elements.save.disabled = false;
        elements.save.textContent = originalText;
    }
};