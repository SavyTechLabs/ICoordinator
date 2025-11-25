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
            schedule: [] // Imported schedule data
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
                this.state = JSON.parse(data);
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
    
    importSchedule(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Assume first sheet
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    
                    this.setState({ schedule: jsonData });
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }
}
