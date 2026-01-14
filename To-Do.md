To-DO

Instruktion:
Alla uppdateringar ska implementeras på ett sådant sätt så att redan existerande projekt inte tar skada. Uppdateringar ska enkelt kunna migreras till existerande projekt.


✅ 1. Uppdatera Datum/vecko vy till start och slutdatum för zoner. Ska också synas på zonen som vecka-dag.
✅ 2. Visa vilken tidsperiod som är filtrerad uppe i högra hörnet. Ska visa vecka-dag till och från. Även när filter är inaktiverat visa vilka veckor som syns. Är filtret aktivt ska de veckorna också synas.
✅ 3. Lägg till kopiera/klistra in i PDF canvas. Metadata ska kopieras till den nya instansen.
✅ 4. Lägg till funktion för att ändra texten. Om möjligt håll den automatiskt synlig mot bakgrundsfärgen. Med manuell override.
✅ 5. Funktion för att markera flera objekt samtidigt så som en rektangel selection.
✅ 6. Lägg till funktion för att ändra fyllnings mönster.
✅ 7. Lägg till Bring to front och Bring to back.
✅ 8. Ta bort att backspace raderar zoner i canvas. ska endast användas för skrift. Behåll delete för att delita objekt i canvas.
✅ 9. lägg till text för legal rights etc.
✅ 10. Ctrl Z för att ångra backa i canvas.

✅ 11. Dolda objekt går inte att få fram igen? Under Filter menyn går det att visa dålda objekt.
✅ 12. Datumen uppe till höger ska visa det filter som är aktivt gällande datum, verkar inte fungera.
✅ 13. I väldigt små objekt bör texten vara dold, alternativt att den står bredvid.
✅ 14. Gör så att denna visar vilka filter som är aktiva, just nu blockerar den dessutom laoyten. När man skriver ut PDF blockerar den layouten:
✅ 15. I utskrift ska datumfiltret uppe till höger stå med.
✅ 15. Ändra formatet på datum till W4d3-W6d1,
✅ 16. Gör texten större i rutorna
✅ 17. kan upplösningen på utskrifter bli bättre?
✅ 18. Flytta filter för vecka till canvas.




Future Improvments

1. Request system för att fråga om ärende att få utföra jobb i zonen. Baserat på vecka. Ska vara knutet till zonen.
(Kräver databas)

2.
### Future Improvements
- [ ] **PDF Metadata Import (Bluebeam Integration)**
    - **Goal:** Automatically create Zones from Bluebeam PDF rectangles and map their "WBS" custom metadata to Activity Codes.
    - **Implementation Plan:**
        1.  **Analysis:** Use `pdf.js` `getAnnotations()` during upload to inspect PDF objects.
        2.  **Coordinate Conversion:** Map PDF coordinate system (points, bottom-left origin) to Canvas coordinate system (pixels, top-left origin).
        3.  **Data Mapping:** Extract the "WBS" value from the annotation's data (likely in `contents` or a custom dictionary) and assign it to the Zone's properties.
        4.  **UI:** Prompt the user upon PDF upload if annotations are found: "Found X zones. Import?"

3. Importera bluebeam annoitations som skapats i bluebeam till zone planner.
