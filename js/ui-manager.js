/**
 * UI Manager
 * Handles sidebar interactions, metadata forms, and file inputs.
 */

class UIManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.canvasManager = null; // Set later
        
        this.elements = {
            // Tools
            toolSelect: document.getElementById('tool-select'),
            toolDraw: document.getElementById('tool-draw'),
            
            // Zoom
            zoomIn: document.getElementById('zoom-in'),
            zoomOut: document.getElementById('zoom-out'),
            zoomLevel: document.getElementById('zoom-level'),
            
            // Metadata
            metadataContent: document.getElementById('metadata-content'),
            metadataEmpty: document.getElementById('metadata-empty'),
            metaId: document.getElementById('meta-id'),
            metaName: document.getElementById('meta-name'),
            metaDiscipline: document.getElementById('meta-discipline'),
            metaStatus: document.getElementById('meta-status'),
            metaColor: document.getElementById('meta-color'),
            metaComments: document.getElementById('meta-comments'),
            btnDeleteZone: document.getElementById('btn-delete-zone'),
            
            // Custom Fields
            customFieldsContainer: document.getElementById('custom-fields-container'),
            btnAddField: document.getElementById('btn-add-field'),

            // File Inputs
            layoutUpload: document.getElementById('layout-upload'),
            scheduleUpload: document.getElementById('schedule-upload'),
            jsonUpload: document.getElementById('json-upload'),
            btnExportJson: document.getElementById('btn-export-json'),
            
            // Layers / Schedule
            scheduleList: document.getElementById('schedule-list')
        };

        this.initEventListeners();
    }

    setCanvasManager(cm) {
        this.canvasManager = cm;
    }

    initEventListeners() {
        // Tools
        this.elements.toolSelect.addEventListener('click', () => this.canvasManager.setTool('select'));
        this.elements.toolDraw.addEventListener('click', () => this.canvasManager.setTool('draw'));

        // Zoom
        this.elements.zoomIn.addEventListener('click', () => this.canvasManager.handleWheel({ deltaY: -1, preventDefault: () => {} }));
        this.elements.zoomOut.addEventListener('click', () => this.canvasManager.handleWheel({ deltaY: 1, preventDefault: () => {} }));

        // Metadata Inputs (Auto-save)
        const inputs = ['metaName', 'metaDiscipline', 'metaStatus', 'metaColor', 'metaComments'];
        inputs.forEach(id => {
            this.elements[id].addEventListener('input', (e) => {
                this.updateSelectedZone(id, e.target.value);
            });
        });

        this.elements.btnDeleteZone.addEventListener('click', () => {
            if (confirm('Är du säker på att du vill ta bort denna zon?')) {
                const zoneId = this.elements.metaId.value;
                this.dataManager.deleteZone(zoneId);
                this.selectZone(null);
                this.canvasManager.draw();
            }
        });

        // File Uploads
        this.elements.layoutUpload.addEventListener('change', (e) => this.handleLayoutUpload(e));
        this.elements.scheduleUpload.addEventListener('change', (e) => this.handleScheduleUpload(e));
        this.elements.jsonUpload.addEventListener('change', (e) => this.handleJsonUpload(e));
        this.elements.btnExportJson.addEventListener('click', () => this.dataManager.exportProject());
        this.elements.btnAddField.addEventListener('click', () => this.addCustomField());
    }

    // --- UI Updates ---

    updateToolState(tool) {
        this.elements.toolSelect.classList.toggle('active', tool === 'select');
        this.elements.toolDraw.classList.toggle('active', tool === 'draw');
    }

    updateZoomLevel(percentage) {
        this.elements.zoomLevel.textContent = `${percentage}%`;
    }

    selectZone(zoneId) {
        if (!zoneId) {
            this.elements.metadataContent.classList.add('hidden');
            this.elements.metadataEmpty.classList.remove('hidden');
            return;
        }

        const zone = this.dataManager.getZone(zoneId);
        if (zone) {
            this.elements.metadataContent.classList.remove('hidden');
            this.elements.metadataEmpty.classList.add('hidden');

            // Populate fields
            this.elements.metaId.value = zone.id;
            this.elements.metaName.value = zone.name || '';
            this.elements.metaDiscipline.value = zone.discipline || '';
            this.elements.metaStatus.value = zone.status || 'planned';
            this.elements.metaColor.value = zone.color || '#2563EB';
            this.elements.metaComments.value = zone.comments || '';
            
            this.renderCustomFields();
        }
    }

    updateSelectedZone(fieldId, value) {
        const zoneId = this.elements.metaId.value;
        if (!zoneId) return;

        const zone = this.dataManager.getZone(zoneId);
        if (!zone) return;

        const updates = {};
        switch (fieldId) {
            case 'metaName': updates.name = value; break;
            case 'metaDiscipline': updates.discipline = value; break;
            case 'metaStatus': updates.status = value; break;
            case 'metaColor': updates.color = value; break;
            case 'metaComments': updates.comments = value; break;
        }

        this.dataManager.updateZone({ ...zone, ...updates });
    }

    // --- File Handling ---

    async handleLayoutUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type === 'application/pdf') {
            this.renderPdf(file);
        } else if (file.type.startsWith('image/')) {
            this.renderImage(file);
        }
    }

    renderImage(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                this.canvasManager.setBackground(img);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    async renderPdf(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(1); // Render first page
        
        const viewport = page.getViewport({ scale: 2.0 }); // High res
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        this.canvasManager.setBackground(canvas);
    }

    async handleScheduleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const data = await this.dataManager.importSchedule(file);
            this.renderSchedule();
            alert(`Importerade ${data.length} aktiviteter från Excel.`);
        } catch (err) {
            console.error(err);
            alert("Fel vid import av Excel-fil.");
        }
    }

    async handleJsonUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            await this.dataManager.importProject(file);
            this.canvasManager.draw();
            alert("Projekt importerat!");
        } catch (err) {
            console.error(err);
            alert("Kunde inte läsa projektfilen.");
        }
    }

    // --- Custom Fields ---

    addCustomField() {
        const fieldName = prompt("Ange namn på nytt fält:");
        if (fieldName) {
            const fieldId = 'custom_' + generateUUID();
            this.dataManager.addCustomField({ id: fieldId, name: fieldName, type: 'text' });
            this.renderCustomFields();
        }
    }

    renderCustomFields() {
        const container = this.elements.customFieldsContainer;
        container.innerHTML = '';
        
        const fields = this.dataManager.getState().customFields;
        const zoneId = this.elements.metaId.value;
        const zone = this.dataManager.getZone(zoneId);

        fields.forEach(field => {
            const div = document.createElement('div');
            div.className = 'form-group';
            
            const label = document.createElement('label');
            label.textContent = field.name;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = zone && zone.customData && zone.customData[field.id] ? zone.customData[field.id] : '';
            
            input.addEventListener('input', (e) => {
                if (zone) {
                    const updatedCustomData = { ...zone.customData, [field.id]: e.target.value };
                    this.dataManager.updateZone({ ...zone, customData: updatedCustomData });
                }
            });

            div.appendChild(label);
            div.appendChild(input);
            container.appendChild(div);
        });
    }

    renderSchedule() {
        const list = this.elements.scheduleList;
        list.innerHTML = '';
        
        const schedule = this.dataManager.getState().schedule;
        
        if (schedule.length === 0) {
            list.innerHTML = '<p class="text-muted small" style="padding: 0.5rem;">Inga aktiviteter.</p>';
            return;
        }

        schedule.forEach((task, index) => {
            // Try to find common column names
            const name = task['Name'] || task['Namn'] || task['Activity'] || task['Task Name'] || 'Okänd Aktivitet';
            const start = task['Start'] || task['Start_Date'] || '';
            const end = task['Finish'] || task['End'] || task['Slut'] || '';
            
            const el = document.createElement('div');
            el.className = 'schedule-item';
            el.draggable = true;
            
            // Format dates if they exist (simple check)
            const dateStr = start ? `${String(start).substring(0, 10)}` : '';

            el.innerHTML = `
                <span class="task-name" title="${name}">${name}</span>
                <div class="task-meta">
                    <span>${dateStr}</span>
                    <span>#${index + 1}</span>
                </div>
            `;

            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify(task));
                e.dataTransfer.effectAllowed = 'copy';
            });

            list.appendChild(el);
        });
    }
}
