const clear = document.getElementById('clear');
const open = document.getElementById('open');
const save = document.getElementById('save');

const zoomOut = document.getElementById('zoom-out');
const zoomLevel = document.getElementById('zoom-level');
const zoomIn = document.getElementById('zoom-in');

let zoom = 0.1;
const minZoom = 0.1;
const maxZoom = 1;

const main = document.querySelector('main');
const h1 = document.querySelector('main h1');

let files = [];

function setupImage(img) {
    img.addEventListener('load', () => updateZoom(), { once: true });
    if (img.complete) updateZoom();
}

function updateZoom() {
    zoomLevel.textContent = `zoom: ${zoom.toFixed(2)}`;
    document.querySelectorAll('figure img').forEach(img => {
        if (img.naturalWidth) {
            img.style.width = `${img.naturalWidth * zoom}px`;
            img.style.height = `${img.naturalHeight * zoom}px`;
        }
    });
}


zoomOut.addEventListener('click', () => {
    zoom /= 10 ** (1 / 9);
    if (zoom < minZoom) zoom = minZoom;
    updateZoom();
});

zoomIn.addEventListener('click', () => {
    zoom *= 10 ** (1 / 9);
    if (zoom > maxZoom) zoom = maxZoom;
    updateZoom();
});

zoomLevel.addEventListener('click', () => {
    zoom = 0.1;
    updateZoom();
});


main.addEventListener('dragover', event => {
    event.preventDefault();
    main.classList.add('drop-hover');
});

main.addEventListener('dragleave', () => {
    main.classList.remove('drop-hover');
});
main.addEventListener('drop', event => {
    event.preventDefault();
    main.classList.remove('drop-hover');
    for (const file of event.dataTransfer.files) {
        if (file.type === 'image/jpeg' || file.type === 'image/png') {
            files.push(file);
            const figure = document.createElement('figure');
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            setupImage(img);
            figure.appendChild(img);
            document.querySelector('main').appendChild(figure);
        }
    }
    clear.disabled = false;
    save.disabled = false;
    h1.style.display = 'none';
});


clear.addEventListener('click', () => {
    document.querySelectorAll('figure').forEach(figure => figure.remove());
    files = [];
    clear.disabled = true;
    save.disabled = true;
    h1.style.display = '';
});

open.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png';
    input.multiple = true;
    input.addEventListener('change', () => {
        for (const file of input.files) {
            files.push(file);
            const figure = document.createElement('figure');
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            setupImage(img);
            figure.appendChild(img);
            document.querySelector('main').appendChild(figure);
        }
        clear.disabled = false;
        save.disabled = false;
        h1.style.display = 'none';
        }, { once: true });
    input.click();
});

save.addEventListener('click', async () => {
    const pdfDoc = await PDFLib.PDFDocument.create();
    for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        let image;
        if (file.type === 'image/png') {
            image = await pdfDoc.embedPng(arrayBuffer);
        } else if (file.type === 'image/jpeg') {
            image = await pdfDoc.embedJpg(arrayBuffer);
        }
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'images.pdf';
    a.click();
    URL.revokeObjectURL(url);
});