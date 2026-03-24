const fileInput = document.getElementById('config-file');
const fileName = document.getElementById('file-name');
const injectBtn = document.getElementById('inject-btn');
const statusBox = document.getElementById('status-box');
const statusMsg = document.getElementById('status-msg');

let configContent = null;
let originalFileNameStr = 'Injected_Config';

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    fileName.textContent = file.name;
    const baseNameMatch = file.name.match(/(.*?)\.xml$/i);
    originalFileNameStr = baseNameMatch ? baseNameMatch[1] : file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
        configContent = e.target.result;
        injectBtn.disabled = false;
        injectBtn.classList.remove('disabled');
        statusMsg.innerHTML = "XML Ready! Click Inject to push Opmode 61456 into all streams.";
        statusBox.classList.remove('success');
    };
    reader.readAsText(file);
}

fileInput.addEventListener('change', handleFileSelect);

injectBtn.addEventListener('click', () => {
    try {
        if (!configContent) return;
        
        // Counter for replaced opmodes
        let count = 0;

        // Replace value inside tags <string name="pref_opmode...">VALUE</string>
        // STRICT Regex to exclude "pref_opmodes" and "pref_stream_opmode" which breaks the SDK Stream Mode dropdown
        const strictOpmodeContentRegex = /(<(string|int|long)\s+name="(pref_opmode(?:_(?:video|portrait|night|motion|normal|experimental))?_key(?:_[0-9]+|_front)?)">)(.*?)(<\/\2>)/gi;
        let finalXML = configContent.replace(strictOpmodeContentRegex, (match, p1, tag, pName, pVal, pClose) => {
            if (pVal !== '61456') count++;
            return p1 + '61456' + pClose;
        });

        // Replace value attribute in self closing tags <int name="pref_opmode..." value="VALUE" />
        const strictOpmodeAttrRegex = /(<(string|int|long)\s+name="(pref_opmode(?:_(?:video|portrait|night|motion|normal|experimental))?_key(?:_[0-9]+|_front)?)"(?:\s+[^>]*)?value=")(.*?)(".*?\/>)/gi;
        finalXML = finalXML.replace(strictOpmodeAttrRegex, (match, p1, tag, pName, pVal, pClose) => {
            if (pVal !== '61456') count++;
            return p1 + '61456' + pClose;
        });

        // Force adding common stream opmode keys if missing
        const requiredKeys = [
            "pref_opmode_night_key", "pref_opmode_portrait_key", 
            "pref_opmode_video_key", "pref_opmode_normal_key", "pref_opmode_motion_key", "pref_opmode_key",
            "pref_opmode_experimental_key"
        ];
        
        requiredKeys.forEach(reqKey => {
            // Check if it exists natively
            if (!finalXML.includes(`name="${reqKey}"`)) {
                // Determine whether to insert it as a string tag
                const fallbackTag = `    <string name="${reqKey}">61456</string>\n`;
                // Insert it right before </map>
                finalXML = finalXML.replace(/<\/map>/i, fallbackTag + "</map>");
                count++;
            }
        });

        let customName = document.getElementById('output-name').value.trim();
        if (!customName) customName = originalFileNameStr + '_Opmode61456';
        if (!customName.endsWith('.xml')) customName += '.xml';

        triggerDownload(finalXML, customName);
        
        statusMsg.innerHTML = `Success! ✨ Injected <b>61456</b> into ${count} stream parameters! File is downloading...`;
        statusBox.classList.add('success');

    } catch (err) {
        statusMsg.textContent = `Error during injection: ${err.message}`;
        console.error(err);
    }
});

function triggerDownload(content, filename) {
    const blob = new Blob([content], { type: "text/xml" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

const dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', e => { dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if(file) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        const event = new Event('change');
        fileInput.dispatchEvent(event);
    }
});
