/**
 * Main Application Entry Point
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("Zone Planner initializing...");

    // Initialize Managers
    const dataManager = new DataManager();
    const uiManager = new UIManager(dataManager);
    const canvasManager = new CanvasManager('main-canvas', dataManager, uiManager);

    // Link Managers
    uiManager.setCanvasManager(canvasManager);

    // Initial Draw (if data exists from localStorage)
    canvasManager.draw();

    console.log("Zone Planner ready!");
});
