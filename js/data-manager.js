/**
 * Data Manager
 * Handles application state, data persistence, and import/export.
 */

class DataManager {
    constructor() {
        this.state = {
            projectInfo: {
                name: "Nytt Projekt",
                created: new Date().toISOString(),
                lastModified: new Date().toISOString()
            },
            zones: [], // Array of zone objects
            customFields: [], // Array of custom field definitions
            schedule: [], // Imported schedule data
            disciplines: [
                { id: 'construction', name: 'discConstruction', color: '#EF4444' },
                { id: 'electrical', name: 'discElectrical', color: '#F59E0B' },
                { id: 'plumbing', name: 'discPlumbing', color: '#3B82F6' },
                { id: 'ventilation', name: 'discVentilation', color: '#10B981' }
            ],
            statuses: [
                { id: 'planned', name: 'statusPlanned', color: '#94A3B8' },
                { id: 'in-progress', name: 'statusInProgress', color: '#F59E0B' },
                { id: 'completed', name: 'statusCompleted', color: '#10B981' },
                { id: 'delayed', name: 'statusDelayed', color: '#EF4444' }
            ],
            viewMode: 'discipline', // 'discipline' or 'status'
            language: 'sv', // 'sv' or 'en'
            zoneNameMode: 'activity' // 'activity' or 'manual'
        };
        
        this.listeners = [];
        this.loadFromStorage();
    }

    // --- State Management ---

    getState() {
        return this.state;
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.state.projectInfo.lastModified = new Date().toISOString();
        this.notifyListeners();
        this.saveToStorage();
    }

    setLanguage(lang) {
        this.setState({ language: lang });
    }

    setZoneNameMode(mode) {
        this.setState({ zoneNameMode: mode });
    }

    setViewMode(mode) {
        this.setState({ viewMode: mode });
    }

    subscribe(listener) {
        this.listeners.push(listener);
    }

    notifyListeners() {
        this.listeners.forEach(listener => listener(this.state));
    }

    // --- Zone Management ---

    addZone(zone) {
        const newZones = [...this.state.zones, zone];
        this.setState({ zones: newZones });
    }

    updateZone(updatedZone) {
        const newZones = this.state.zones.map(z => 
            z.id === updatedZone.id ? updatedZone : z
        );
        this.setState({ zones: newZones });
    }

    deleteZone(zoneId) {
        const newZones = this.state.zones.filter(z => z.id !== zoneId);
        this.setState({ zones: newZones });
    }

    getZone(zoneId) {
        return this.state.zones.find(z => z.id === zoneId);
    }

    // --- Custom Fields ---

    addCustomField(field) {
        const newFields = [...this.state.customFields, field];
        this.setState({ customFields: newFields });
    }

    removeCustomField(fieldId) {
        const newFields = this.state.customFields.filter(f => f.id !== fieldId);
        this.setState({ customFields: newFields });
    }

    // --- Settings Management ---

    addDiscipline(discipline) {
        const newDisciplines = [...this.state.disciplines, discipline];
        this.setState({ disciplines: newDisciplines });
    }

    removeDiscipline(id) {
        const newDisciplines = this.state.disciplines.filter(d => d.id !== id);
        this.setState({ disciplines: newDisciplines });
    }

    updateDiscipline(updatedDiscipline) {
        const newDisciplines = this.state.disciplines.map(d => 
            d.id === updatedDiscipline.id ? updatedDiscipline : d
        );
        this.setState({ disciplines: newDisciplines });
    }

    addStatus(status) {
        const newStatuses = [...this.state.statuses, status];
        this.setState({ statuses: newStatuses });
    }

    removeStatus(id) {
        const newStatuses = this.state.statuses.filter(s => s.id !== id);
        this.setState({ statuses: newStatuses });
    }

    updateStatus(updatedStatus) {
        const newStatuses = this.state.statuses.map(s => 
            s.id === updatedStatus.id ? updatedStatus : s
        );
        this.setState({ statuses: newStatuses });
    }

    // --- Persistence ---

    saveToStorage() {
        try {
            localStorage.setItem('icoordinator_data', JSON.stringify(this.state));
        } catch (e) {
            console.error("Failed to save to localStorage", e);
        }
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem('icoordinator_data');
            if (data) {
                const loadedState = JSON.parse(data);
                // Merge loaded state with default state to ensure new fields exist
                this.state = { ...this.state, ...loadedState };
                
                // Ensure critical arrays exist
                if (!this.state.disciplines) {
                    this.state.disciplines = [
                        { id: 'construction', name: 'Bygg', color: '#EF4444' },
                        { id: 'electrical', name: 'El', color: '#F59E0B' },
                        { id: 'plumbing', name: 'VVS', color: '#3B82F6' },
                        { id: 'ventilation', name: 'Ventilation', color: '#10B981' }
                    ];
                }
                if (!this.state.statuses) {
                    this.state.statuses = [
                        { id: 'planned', name: 'Planerad', color: '#94A3B8' },
                        { id: 'in-progress', name: 'Pågående', color: '#F59E0B' },
                        { id: 'completed', name: 'Klar', color: '#10B981' },
                        { id: 'delayed', name: 'Försenad', color: '#EF4444' }
                    ];
                }
            }
        } catch (e) {
            console.error("Failed to load from localStorage", e);
        }
    }

    // --- Import/Export ---

    exportProject() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "icoordinator_project.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    importProject(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedState = JSON.parse(event.target.result);
                    // Basic validation could go here
                    this.setState(importedState);
                    resolve(importedState);
                } catch (e) {
                    reject(e);
                }
            };
            reader.readAsText(file);
        });
    }

    // --- Excel Import ---
    
    parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    setSchedule(scheduleData) {
        this.setState({ schedule: scheduleData });
    }
}
