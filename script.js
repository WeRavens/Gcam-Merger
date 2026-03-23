const baseInput = document.getElementById('base-file');
const colorInput = document.getElementById('color-file');
const baseName = document.getElementById('base-file-name');
const colorName = document.getElementById('color-file-name');
const mergeBtn = document.getElementById('merge-btn');
const statusBox = document.getElementById('status-box');
const statusMsg = document.getElementById('status-msg');

let baseContent = (typeof defaultBaseXML !== 'undefined') ? defaultBaseXML : null;
let colorContent = null;
let baseFileNameStr = 'Base_Config.xml';

// Pattern of Image Processing / Color parameters to extract
const colorPatterns = [
    /^lib_saturation.*/, /^lib_contrast.*/, /^lib_cg\d*.*/,
    /^lib_gamma.*/, /^lib_tone.*/, /^lib_curve.*/, /^pref_tonecurve.*/, /^pref_gammacurve.*/,
    /^rg_.*/, /^bg_.*/, /^gg_.*/, /^gb_.*/, /^br_.*/, /^bb_.*/, /^rr_.*/, /^rb_.*/, /^gr_.*/,
    /^d50_.*/, /^d65_.*/, /^d75_.*/, /^cw_.*/, /^f_.*/, /^tl84_.*/,
    /^a_bg_.*/, /^a_rg_.*/, /^h_bg_.*/, /^h_rg_.*/,
    /^pref_satCCT_.*/, /^pref_global_hue_.*/, /^pref_[RGB]_hue_.*/,
    /^CCT_WB_.*/, /^WB_.*/,
    /^red_key_.*/, /^green_key_.*/, /^blue_key_.*/,
    /^lib_expocomp.*/, /^lib_exposure.*/, /^lib_brightness.*/, /^lib_light.*/, 
    /^lib_dehazed.*/, /^lib_shadow.*/, /^lib_highlight.*/, /^lib_clarity.*/,
    /^pref_color_transform.*/
];

// Handles file parsing
function handleFileSelect(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    if (type === 'base') {
        baseName.textContent = file.name;
        baseFileNameStr = file.name.replace('.xml', '') + ' (Ultimate Color Merged).xml';
    } else {
        colorName.textContent = file.name;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        if (type === 'base') baseContent = e.target.result;
        else colorContent = e.target.result;
        
        checkReadyState();
    };
    reader.readAsText(file);
}

function checkReadyState() {
    if (baseContent && colorContent) {
        mergeBtn.disabled = false;
        mergeBtn.classList.remove('disabled');
        statusMsg.innerHTML = "Files ready! <b>Optional:</b> Enter a custom output name, then click Merge.";
        statusBox.classList.remove('success');
    }
}

// Initial check in case baseContent is already defined by dtuxBase.js
// but we just wait for colorContent to be uploaded.

baseInput.addEventListener('change', (e) => handleFileSelect(e, 'base'));
colorInput.addEventListener('change', (e) => handleFileSelect(e, 'color'));

// XML Merge Logic
mergeBtn.addEventListener('click', () => {
    try {
        const baseMap = new Map();
        const colorMap = new Map();
        
        // This Regex safely grabs entire tags strictly without altering their exact spacing/properties
        const tagRegex = /<(string|boolean|int|long|float)\s+name="([^"]+)"[\s\S]*?(?:<\/\1>|\/>)/g;
        
        let match;
        // Parse Base XML
        while ((match = tagRegex.exec(baseContent)) !== null) {
            baseMap.set(match[2], match[0]);
        }
        
        // Parse Color XML
        while ((match = tagRegex.exec(colorContent)) !== null) {
            colorMap.set(match[2], match[0]);
        }

        let migrated = 0;
        let finalXML = "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\n<map>\n";
        const keysToWrite = new Set();

        // 1. Write the base parameters, swapping colors if present
        for (const [key, baseTag] of baseMap.entries()) {
            keysToWrite.add(key);
            let tagToWrite = baseTag;
            
            if (colorMap.has(key) && colorPatterns.some(regex => regex.test(key))) {
                tagToWrite = colorMap.get(key); // Substitute with Exact Color String
                migrated++;
            }
            finalXML += "    " + tagToWrite + "\n";
        }

        // 2. Append missing color parameters into the XML
        for (const [key, colorTag] of colorMap.entries()) {
            if (!keysToWrite.has(key) && colorPatterns.some(regex => regex.test(key))) {
                finalXML += "    " + colorTag + "\n";
                migrated++;
            }
        }
        
        finalXML += "</map>\n";

        let customName = document.getElementById('output-name').value.trim();
        if (!customName) customName = 'Ultimate_Merged_Config';
        if (!customName.endsWith('.xml')) customName += '.xml';

        triggerDownload(finalXML, customName);
        
        statusMsg.innerHTML = `Success! ✨ Merged <b>${migrated} Aesthetic keys</b> safely! File is downloading...`;
        statusBox.classList.add('success');

    } catch (err) {
        statusMsg.textContent = `Error during merge: ${err.message}`;
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

// Drag & Drop visual feedbacks
['base-drop-zone', 'color-drop-zone'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', e => { el.classList.remove('drag-over'); });
    el.addEventListener('drop', e => {
        e.preventDefault();
        el.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if(file) {
            const inputId = id === 'base-drop-zone' ? 'base-file' : 'color-file';
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            document.getElementById(inputId).files = dataTransfer.files;
            
            // trigger change event
            const event = new Event('change');
            document.getElementById(inputId).dispatchEvent(event);
        }
    });
});
