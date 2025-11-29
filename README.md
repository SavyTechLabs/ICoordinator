# ICoordinator

## Project Overview
ICoordinator is a web-based application for managing construction layouts, zones, and activities.

## To-Do List

### Future Improvements
- [ ] **PDF Metadata Import (Bluebeam Integration)**
    - **Goal:** Automatically create Zones from Bluebeam PDF rectangles and map their "WBS" custom metadata to Activity Codes.
    - **Implementation Plan:**
        1.  **Analysis:** Use `pdf.js` `getAnnotations()` during upload to inspect PDF objects.
        2.  **Coordinate Conversion:** Map PDF coordinate system (points, bottom-left origin) to Canvas coordinate system (pixels, top-left origin).
        3.  **Data Mapping:** Extract the "WBS" value from the annotation's data (likely in `contents` or a custom dictionary) and assign it to the Zone's properties.
        4.  **UI:** Prompt the user upon PDF upload if annotations are found: "Found X zones. Import?"
