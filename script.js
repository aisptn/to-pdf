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

const handleFiles = (newFiles) => {
    Array.from(newFiles).forEach(file => {
        if (!['image/jpeg', 'image/png'].includes(file.type)) return;

        files.push(file);
        const figure = document.createElement('figure');
        const img = document.createElement('img');
        const url = URL.createObjectURL(file);
        objectUrls.push(url);
        img.src = url;
        
        img.onload = () => updateDisplay();

        figure.appendChild(img);
        elements.main.appendChild(figure);
    });
};

elements.zoomOut.onclick = () => { zoom = Math.max(0.01, zoom / 1.2); updateDisplay(); };
elements.zoomIn.onclick = () => { zoom = Math.min(2.0, zoom * 1.2); updateDisplay(); };
elements.zoomLevel.onclick = () => { zoom = 0.1; updateDisplay(); };

elements.main.ondragover = (e) => { e.preventDefault(); elements.main.classList.add('drop-hover'); };
elements.main.ondragleave = () => elements.main.classList.remove('drop-hover');
elements.main.ondrop = (e) => {
    e.preventDefault();
    elements.main.classList.remove('drop-hover');
    handleFiles(e.dataTransfer.files);
};

elements.open.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png';
    input.multiple = true;
    input.onchange = () => handleFiles(input.files);
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

    if (typeof jsPDF !== 'function') {
        console.error("jsPDF constructor not found or is not a function. Please ensure the jsPDF library is loaded correctly in your HTML (e.g., via <script src=\"https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js\"></script>).");
        alert("Error: PDF library not loaded. Cannot save PDF.");
        return; // Stop execution if jsPDF is not available
    }
    const images = elements.main.querySelectorAll('figure img');
    let doc;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const img = images[i];
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        
        if (!w || !h) {
            console.warn(`Skipping image ${i}: Not fully loaded.`);
            continue;
        }

        const format = file.type === 'image/jpeg' ? 'JPEG' : 'PNG';
        
        const buffer = await file.arrayBuffer();
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

        // Passing 'NONE' as the compression method instructs jsPDF 
        // to embed the raw bytes without re-processing/re-encoding.
        doc.addImage(data, format, 0, 0, w, h, undefined, 'NONE');
    }

    if (doc) doc.save('images.pdf');
};