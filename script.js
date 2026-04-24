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

    document.querySelectorAll('figure img').forEach(img => {
        if (img.naturalWidth) {
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
            file: file,
            orientation: 1
        };
        files.push(fileEntry);

        const figure = document.createElement('figure');
        const img = document.createElement('img');
        const url = URL.createObjectURL(file);
        objectUrls.push(url);
        img.src = url;
        
        img.onload = () => updateDisplay();

        figure.appendChild(img);
        elements.main.appendChild(figure);

        const exifPromise = new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const buffer = e.target.result;
                const bytes = new Uint8Array(buffer);
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

elements.save.onclick = async () => {
    const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
    const images = elements.main.querySelectorAll('figure img');
    let doc;

    for (let i = 0; i < files.length; i++) {
        const { file: originalFile, orientation } = files[i];
        const img = images[i];
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        const swapDimensions = orientation >= 5 && orientation <= 8;
        if (swapDimensions) {
            [w, h] = [h, w];
        }

        const format = originalFile.type === 'image/jpeg' ? 'JPEG' : 'PNG';
        
        const buffer = await originalFile.arrayBuffer();
        const data = new Uint8Array(buffer);

        if (!doc) {
            doc = new jsPDF({
                orientation: w > h ? 'l' : 'p',
                unit: 'px',
                format: [w, h],
                hotfixes: ["px_scaling"]
            });
        } else {
            doc.addPage([w, h], w > h ? 'l' : 'p');
        }
        doc.addImage(data, format, 0, 0, w, h, undefined, 'NONE');
    }

    if (doc) doc.save('images.pdf');
};