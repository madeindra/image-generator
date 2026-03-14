const modelSelect = document.getElementById('model-select');
const imageInput = document.getElementById('image-input');
const previewContainer = document.getElementById('preview-container');
const gptSettings = document.getElementById('gpt-settings');
const geminiSettings = document.getElementById('gemini-settings');
const inputFidelitySection = document.getElementById('input-fidelity-section');

let selectedFiles = [];
let geminiOutputMode = 'images_text'; // 'images_text' or 'images_only'

function setGeminiOutput(mode) {
    geminiOutputMode = mode;
    document.getElementById('gemini-output-images-text').classList.toggle('active', mode === 'images_text');
    document.getElementById('gemini-output-images-only').classList.toggle('active', mode === 'images_only');
}

modelSelect.addEventListener('change', function () {
    if (this.value === 'gpt') {
        gptSettings.style.display = 'block';
        geminiSettings.style.display = 'none';
    } else {
        gptSettings.style.display = 'none';
        geminiSettings.style.display = 'block';
    }
});

imageInput.addEventListener('change', function () {
    const newFiles = Array.from(this.files);
    selectedFiles = [...selectedFiles, ...newFiles];
    this.value = '';
    updatePreviews();
    updateInputFidelityVisibility();
});

const fileInputLabel = document.querySelector('.file-input-label');

fileInputLabel.addEventListener('dragover', function (e) {
    e.preventDefault();
    this.classList.add('drag-over');
});

fileInputLabel.addEventListener('dragleave', function () {
    this.classList.remove('drag-over');
});

fileInputLabel.addEventListener('drop', function (e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    selectedFiles = [...selectedFiles, ...newFiles];
    updatePreviews();
    updateInputFidelityVisibility();
});

function updateInputFidelityVisibility() {
    inputFidelitySection.style.display = selectedFiles.length > 0 ? 'block' : 'none';
}

function updatePreviews() {
    previewContainer.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `
                <img src="${e.target.result}" alt="Preview ${index + 1}">
                <button onclick="removeImage(${index})">×</button>
            `;
            previewContainer.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function removeImage(index) {
    selectedFiles.splice(index, 1);
    updatePreviews();
    updateInputFidelityVisibility();
}

function toggleAdvanced() {
    const btn = document.getElementById('advanced-toggle');
    const panel = document.getElementById('advanced-settings');
    btn.classList.toggle('open');
    panel.classList.toggle('open');
}

async function generateImage() {
    const model = modelSelect.value;
    const prompt = document.getElementById('prompt').value;
    const errorDiv = document.getElementById('error');
    const resultDiv = document.getElementById('result');

    errorDiv.style.display = 'none';
    resultDiv.style.display = 'none';
    errorDiv.textContent = '';

    if (!prompt.trim()) {
        showError('Please enter a prompt.');
        return;
    }

    if (model === 'gpt') {
        await generateWithGPT(prompt);
    } else {
        await generateWithGemini(prompt);
    }
}

async function generateWithGPT(prompt) {
    const loading = document.getElementById('loading');
    const generateBtn = document.getElementById('generate-btn');

    const model = document.getElementById('gpt-model').value;
    const size = document.getElementById('size').value;
    const quality = document.getElementById('quality').value;
    const numImages = parseInt(document.getElementById('num-images').value);
    const outputFormat = document.getElementById('output-format').value;
    const background = document.getElementById('background').value;
    const moderation = document.getElementById('moderation').value;
    const partialImages = parseInt(document.getElementById('partial-images').value);
    const inputFidelity = document.getElementById('input-fidelity').value;

    const isEdit = selectedFiles.length > 0;

    try {
        loading.style.display = 'block';
        generateBtn.disabled = true;

        let fetchOptions;
        if (isEdit) {
            const formData = new FormData();
            formData.append('model', model);
            formData.append('prompt', prompt);
            formData.append('n', numImages);
            formData.append('size', size);
            formData.append('quality', quality);
            formData.append('output_format', outputFormat);
            if (background !== 'auto') formData.append('background', background);
            if (moderation !== 'auto') formData.append('moderation', moderation);
            if (partialImages > 0) formData.append('partial_images', partialImages);
            for (const file of selectedFiles) {
                formData.append('image[]', file);
            }
            formData.append('input_fidelity', inputFidelity);
            fetchOptions = { method: 'POST', body: formData };
        } else {
            const body = {
                model,
                prompt,
                n: numImages,
                size,
                quality,
                output_format: outputFormat,
            };
            if (background !== 'auto') body.background = background;
            if (moderation !== 'auto') body.moderation = moderation;
            if (partialImages > 0) body.partial_images = partialImages;
            fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            };
        }

        const proxyEndpoint = isEdit
            ? '/api/openai/v1/images/edits'
            : '/api/openai/v1/images/generations';

        const response = await fetch(proxyEndpoint, fetchOptions);

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'API request failed');
        }

        // Handle both b64_json and url response formats
        const results = data.data.map(item => ({
            url: item.url || `data:image/${outputFormat};base64,${item.b64_json}`
        }));
        displayResults(results, outputFormat);

    } catch (error) {
        showError(`Error: ${error.message}`);
    } finally {
        loading.style.display = 'none';
        generateBtn.disabled = false;
    }
}

async function generateWithGemini(prompt) {
    const loading = document.getElementById('loading');
    const generateBtn = document.getElementById('generate-btn');
    const model = document.getElementById('gemini-model').value;
    const aspect = document.getElementById('aspect').value;
    const imageSize = document.getElementById('image-size').value;
    const temperature = parseFloat(document.getElementById('gemini-temperature').value);
    const useGrounding = document.getElementById('tool-grounding').checked;
    const useImageSearch = document.getElementById('tool-image-search').checked;

    try {
        loading.style.display = 'block';
        generateBtn.disabled = true;

        const parts = [{ text: prompt }];

        for (const file of selectedFiles) {
            const base64Image = await fileToBase64(file);
            parts.push({
                inline_data: {
                    mime_type: file.type,
                    data: base64Image.split(',')[1]
                }
            });
        }

        const responseModalities = geminiOutputMode === 'images_only' ? ['IMAGE'] : ['IMAGE', 'TEXT'];

        const imageConfig = {};
        if (aspect) imageConfig.aspectRatio = aspect;
        if (imageSize) imageConfig.imageSize = imageSize;

        const requestBody = {
            contents: [{ parts }],
            generationConfig: {
                responseModalities,
                temperature,
                imageConfig
            },
        };

        if (useImageSearch) {
            requestBody.tools = [{ googleSearch: { searchTypes: { webSearch: {}, imageSearch: {} } } }];
        } else if (useGrounding) {
            requestBody.tools = [{ google_search: {} }];
        }

        const response = await fetch(
            `/api/gemini/v1beta/models/${model}:generateContent`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'API request failed');
        }

        const imageParts = data.candidates[0].content.parts.filter(part => part.inlineData);

        if (imageParts.length === 0) {
            throw new Error('No image data in response');
        }

        const results = imageParts.map(part => ({
            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
        }));

        displayResults(results, 'png');

    } catch (error) {
        showError(`Error: ${error.message}`);
    } finally {
        loading.style.display = 'none';
        generateBtn.disabled = false;
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function displayResults(images, format = 'png') {
    const resultDiv = document.getElementById('result');
    const resultImages = document.getElementById('result-images');

    resultImages.innerHTML = '';

    images.forEach((image, index) => {
        const div = document.createElement('div');
        div.innerHTML = `
            <img src="${image.url}" alt="Generated ${index + 1}">
            <a href="${image.url}" download="generated_${index + 1}.${format}" class="download-btn">
                Download
            </a>
        `;
        resultImages.appendChild(div);
    });

    resultDiv.style.display = 'block';
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}
