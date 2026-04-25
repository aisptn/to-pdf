self.onmessage = async (event) => {
    const { entries } = event.data;

    try {
        importScripts('https://unpkg.com/jspdf@latest/dist/jspdf.umd.min.js');
        const jsPDF = self.jspdf?.jsPDF || self.jsPDF;
        if (!jsPDF) {
            throw new Error('jsPDF not found in worker');
        }

        const baseWidth = entries[0].pageWidth;
        const baseHeight = entries[0].pageHeight;
        const baseHypotenuse = Math.hypot(baseWidth, baseHeight) || 1;

        let doc;
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const orientation = entry.pageWidth > entry.pageHeight ? 'l' : 'p';

            if (!doc) {
                doc = new jsPDF({
                    orientation: orientation,
                    unit: 'px',
                    format: [entry.pageWidth, entry.pageHeight],
                    hotfixes: ['px_scaling']
                });
            } else {
                doc.addPage([entry.pageWidth, entry.pageHeight], orientation);
            }

            const format = entry.type === 'image/jpeg' ? 'JPEG' : 'PNG';
            const compression = format === 'PNG' ? 'SLOW' : 'NONE';
            const imageData = new Uint8Array(entry.data);
            doc.addImage(imageData, format, 0, 0, entry.pageWidth, entry.pageHeight, undefined, compression);
        }

        const pdf = doc.output('arraybuffer');
        self.postMessage({ type: 'success', pdf }, [pdf]);
    } catch (error) {
        self.postMessage({ type: 'error', message: error?.message || String(error) });
    }
};
