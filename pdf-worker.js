self.onmessage = async (event) => {
    const { entries } = event.data;

    try {
        importScripts('https://unpkg.com/jspdf@latest/dist/jspdf.umd.min.js');
        const jsPDF = self.jspdf?.jsPDF || self.jsPDF;
        if (!jsPDF) {
            throw new Error('jsPDF not found in worker');
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
        }

        const pdf = doc.output('arraybuffer');
        self.postMessage({ type: 'success', pdf }, [pdf]);
    } catch (error) {
        self.postMessage({ type: 'error', message: error?.message || String(error) });
    }
};
