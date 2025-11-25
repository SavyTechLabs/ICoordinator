/**
 * Canvas Manager
 * Handles drawing, interactions, and rendering of the layout and zones.
 */

class CanvasManager {
    constructor(canvasId, dataManager, uiManager) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.dataManager = dataManager;
        this.uiManager = uiManager;

        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        
        this.isDragging = false;
        this.isDrawing = false;
        this.isResizing = false;
        
        this.startPos = { x: 0, y: 0 };
        this.currentPos = { x: 0, y: 0 };
        
        this.activeTool = 'select'; // 'select' or 'draw'
        this.selectedZoneId = null;
        this.hoveredZoneId = null;
        this.resizeHandle = null; // 'tl', 'tr', 'bl', 'br'

        this.backgroundImage = null;
        
        this.initEventListeners();
        this.resizeCanvas();
        
        // Subscribe to data changes to redraw
        this.dataManager.subscribe(() => {
            this.draw();
        });

        window.addEventListener('resize', () => this.resizeCanvas());
    }

    initEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.canvas.addEventListener('drop', (e) => this.handleDrop(e));
    }

    resizeCanvas() {
        const wrapper = this.canvas.parentElement;
        this.canvas.width = wrapper.clientWidth;
        this.canvas.height = wrapper.clientHeight;
        this.draw();
    }

    // --- Coordinate Conversion ---

    getMousePos(evt) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (evt.clientX - rect.left - this.offsetX) / this.scale,
            y: (evt.clientY - rect.top - this.offsetY) / this.scale
        };
    }

    // --- Input Handling ---

    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        this.startPos = pos;

        if (this.activeTool === 'draw') {
            this.isDrawing = true;
            // Create a temporary zone
            this.tempZone = {
                x: pos.x,
                y: pos.y,
                width: 0,
                height: 0
            };
        } else if (this.activeTool === 'select') {
            // Check for resize handles first if a zone is selected
            if (this.selectedZoneId) {
                const zone = this.dataManager.getZone(this.selectedZoneId);
                this.resizeHandle = this.getResizeHandle(pos, zone);
                if (this.resizeHandle) {
                    this.isResizing = true;
                    return;
                }
            }

            // Check for zone selection
            const clickedZone = this.getZoneAt(pos);
            
            if (clickedZone) {
                this.selectedZoneId = clickedZone.id;
                this.isDragging = true;
                this.uiManager.selectZone(clickedZone.id);
            } else {
                this.selectedZoneId = null;
                this.uiManager.selectZone(null);
                // Start panning if clicking on empty space
                this.isPanning = true;
                this.panStart = { x: e.clientX, y: e.clientY };
            }
            this.draw();
        }
    }

    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        this.currentPos = pos;

        if (this.isDrawing) {
            this.tempZone.width = pos.x - this.startPos.x;
            this.tempZone.height = pos.y - this.startPos.y;
            this.draw();
        } else if (this.isDragging && this.selectedZoneId) {
            const zone = this.dataManager.getZone(this.selectedZoneId);
            const dx = pos.x - this.startPos.x;
            const dy = pos.y - this.startPos.y;
            
            const updatedZone = {
                ...zone,
                x: zone.x + dx,
                y: zone.y + dy
            };
            
            this.dataManager.updateZone(updatedZone);
            this.startPos = pos; // Reset start pos for continuous drag
        } else if (this.isResizing && this.selectedZoneId) {
            const zone = this.dataManager.getZone(this.selectedZoneId);
            this.resizeZone(zone, pos);
        } else if (this.isPanning) {
            const dx = e.clientX - this.panStart.x;
            const dy = e.clientY - this.panStart.y;
            this.offsetX += dx;
            this.offsetY += dy;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.draw();
        } else {
            // Hover effects
            const hovered = this.getZoneAt(pos);
            if (hovered?.id !== this.hoveredZoneId) {
                this.hoveredZoneId = hovered?.id || null;
                this.canvas.style.cursor = hovered ? 'move' : 'default';
                this.draw();
            }
            
            // Cursor for resize handles
            if (this.selectedZoneId && !this.isDragging) {
                const zone = this.dataManager.getZone(this.selectedZoneId);
                const handle = this.getResizeHandle(pos, zone);
                if (handle) {
                    this.canvas.style.cursor = handle === 'tl' || handle === 'br' ? 'nwse-resize' : 'nesw-resize';
                } else if (!hovered) {
                    this.canvas.style.cursor = 'default';
                }
            }
        }
    }

    handleMouseUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            // Normalize zone (negative width/height)
            const zone = {
                id: generateUUID(),
                x: Math.min(this.startPos.x, this.currentPos.x),
                y: Math.min(this.startPos.y, this.currentPos.y),
                width: Math.abs(this.tempZone.width),
                height: Math.abs(this.tempZone.height),
                color: '#2563EB', // Default color
                opacity: 0.5,
                name: 'Ny Zon',
                discipline: '',
                status: 'planned',
                comments: '',
                customData: {}
            };
            
            // Only add if it has some size
            if (zone.width > 5 && zone.height > 5) {
                this.dataManager.addZone(zone);
                this.selectedZoneId = zone.id;
                this.uiManager.selectZone(zone.id);
                // Switch back to select tool after drawing
                this.setTool('select');
            }
            this.tempZone = null;
        }
        
        this.isDragging = false;
        this.isResizing = false;
        this.isPanning = false;
        this.resizeHandle = null;
        this.draw();
    }

    handleWheel(e) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
        const newScale = Math.max(0.1, Math.min(5, this.scale + delta));
        
        // Zoom towards mouse pointer
        // Logic simplified for MVP: Zoom center
        // Better logic:
        // 1. Get mouse pos in world coords before zoom
        // 2. Apply zoom
        // 3. Adjust offset so mouse pos in world coords stays same
        
        this.scale = newScale;
        this.uiManager.updateZoomLevel(Math.round(this.scale * 100));
        this.draw();
    }

    // --- Logic ---

    setTool(tool) {
        this.activeTool = tool;
        this.canvas.style.cursor = tool === 'draw' ? 'crosshair' : 'default';
        this.uiManager.updateToolState(tool);
    }

    getZoneAt(pos) {
        // Iterate in reverse to select top-most
        const zones = this.dataManager.getState().zones;
        for (let i = zones.length - 1; i >= 0; i--) {
            const z = zones[i];
            if (pos.x >= z.x && pos.x <= z.x + z.width &&
                pos.y >= z.y && pos.y <= z.y + z.height) {
                return z;
            }
        }
        return null;
    }

    getResizeHandle(pos, zone) {
        const handleSize = 10 / this.scale;
        // Check corners
        if (Math.abs(pos.x - zone.x) < handleSize && Math.abs(pos.y - zone.y) < handleSize) return 'tl';
        if (Math.abs(pos.x - (zone.x + zone.width)) < handleSize && Math.abs(pos.y - zone.y) < handleSize) return 'tr';
        if (Math.abs(pos.x - zone.x) < handleSize && Math.abs(pos.y - (zone.y + zone.height)) < handleSize) return 'bl';
        if (Math.abs(pos.x - (zone.x + zone.width)) < handleSize && Math.abs(pos.y - (zone.y + zone.height)) < handleSize) return 'br';
        return null;
    }

    resizeZone(zone, pos) {
        let newX = zone.x;
        let newY = zone.y;
        let newW = zone.width;
        let newH = zone.height;

        if (this.resizeHandle.includes('l')) {
            const dx = pos.x - zone.x;
            newX += dx;
            newW -= dx;
        }
        if (this.resizeHandle.includes('r')) {
            newW = pos.x - zone.x;
        }
        if (this.resizeHandle.includes('t')) {
            const dy = pos.y - zone.y;
            newY += dy;
            newH -= dy;
        }
        if (this.resizeHandle.includes('b')) {
            newH = pos.y - zone.y;
        }

        // Prevent negative size
        if (newW > 5 && newH > 5) {
            this.dataManager.updateZone({
                ...zone,
                x: newX,
                y: newY,
                width: newW,
                height: newH
            });
        }
    }

    // --- Rendering ---

    setBackground(imageOrCanvas) {
        this.backgroundImage = imageOrCanvas;
        
        // Calculate scale to fit
        const scaleX = this.canvas.width / imageOrCanvas.width;
        const scaleY = this.canvas.height / imageOrCanvas.height;
        this.scale = Math.min(scaleX, scaleY) * 0.9; // 90% fit
        
        // Update UI zoom level
        this.uiManager.updateZoomLevel(Math.round(this.scale * 100));

        // Center image
        this.offsetX = (this.canvas.width - imageOrCanvas.width * this.scale) / 2;
        this.offsetY = (this.canvas.height - imageOrCanvas.height * this.scale) / 2;
        
        this.draw();
        
        // Hide empty state
        document.getElementById('empty-state').style.display = 'none';
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Draw Background
        if (this.backgroundImage) {
            this.ctx.drawImage(this.backgroundImage, 0, 0);
        }

        // Draw Zones
        const zones = this.dataManager.getState().zones;
        zones.forEach(zone => {
            this.drawZone(zone);
        });

        // Draw Temp Zone (while drawing)
        if (this.isDrawing && this.tempZone) {
            this.ctx.fillStyle = 'rgba(37, 99, 235, 0.3)';
            this.ctx.strokeStyle = '#2563EB';
            this.ctx.lineWidth = 2 / this.scale;
            this.ctx.fillRect(this.tempZone.x, this.tempZone.y, this.tempZone.width, this.tempZone.height);
            this.ctx.strokeRect(this.tempZone.x, this.tempZone.y, this.tempZone.width, this.tempZone.height);
        }

        this.ctx.restore();
    }

    drawZone(zone) {
        const isSelected = zone.id === this.selectedZoneId;
        
        this.ctx.fillStyle = hexToRgba(zone.color, zone.opacity || 0.5);
        this.ctx.fillRect(zone.x, zone.y, zone.width, zone.height);

        this.ctx.strokeStyle = isSelected ? '#F59E0B' : zone.color;
        this.ctx.lineWidth = (isSelected ? 3 : 1) / this.scale;
        this.ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);

        // Draw Label
        this.ctx.fillStyle = 'white';
        this.ctx.font = `${14 / this.scale}px Inter`;
        this.ctx.shadowColor = "rgba(0,0,0,0.5)";
        this.ctx.shadowBlur = 4;
        this.ctx.fillText(zone.name, zone.x + 5 / this.scale, zone.y + 20 / this.scale);
        this.ctx.shadowBlur = 0;

        // Draw Resize Handles if selected
        if (isSelected) {
            this.drawResizeHandles(zone);
        }
    }

    drawResizeHandles(zone) {
        const handleSize = 8 / this.scale;
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = '#F59E0B';
        this.ctx.lineWidth = 1 / this.scale;

        const coords = [
            { x: zone.x, y: zone.y }, // TL
            { x: zone.x + zone.width, y: zone.y }, // TR
            { x: zone.x, y: zone.y + zone.height }, // BL
            { x: zone.x + zone.width, y: zone.y + zone.height } // BR
        ];

        coords.forEach(c => {
            this.ctx.beginPath();
            this.ctx.arc(c.x, c.y, handleSize / 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        });
    }

    // --- Drag & Drop (Excel Mapping) ---

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        
        // Highlight zone under mouse
        const pos = this.getMousePos(e);
        const hovered = this.getZoneAt(pos);
        
        if (hovered?.id !== this.hoveredZoneId) {
            this.hoveredZoneId = hovered?.id || null;
            this.draw();
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const pos = this.getMousePos(e);
        const zone = this.getZoneAt(pos);

        if (zone) {
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                
                // Map Excel data to Zone
                // We try to map common fields intelligently
                const name = data['Name'] || data['Namn'] || data['Activity'] || data['Task Name'];
                const start = data['Start'] || data['Start_Date'];
                const end = data['Finish'] || data['End'] || data['Slut'];
                
                const updates = {
                    customData: {
                        ...zone.customData,
                        ...data // Store all raw data in customData
                    }
                };

                if (name) updates.name = name;
                
                // Update status based on dates (simple logic)
                // Could be expanded later
                
                this.dataManager.updateZone({ ...zone, ...updates });
                this.uiManager.selectZone(zone.id); // Refresh UI
                
                // Visual feedback
                alert(`Kopplade aktivitet "${name}" till zon!`);
                
            } catch (err) {
                console.error("Failed to parse dropped data", err);
            }
        }
    }
}
