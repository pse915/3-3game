# v3 original asset work

The environment atlas was newly generated for this game on 2026-10-11. The original source is preserved in `environment-source.png`; the production atlas uses the existing 1024 by 1024 contract, sixteen 256 by 256 cells in four rows. Cell semantics and all map asset indices remain compatible. The new tree, cherry tree, classroom desk, bookshelf, school facade, door, cafe, clinic, fountain, bench, chalkboard, plant, cafe counter, lab table, computer desk and diary are original generated artwork. The existing town-building, furniture, facility and detail atlases remain in use. A complete art overhaul is therefore **partial**, not a verified 10/10 result.

Six original characters are authored in `tools/build_avatars.py`. `avatars.png` contains six vertically stacked 256 by 192 sheets with eight columns and four direction rows. Every frame is 32 by 48 pixels. The direction order is down, left, right, up; columns 0 to 3 are walking and columns 4 to 7 are running. Characters have different hair silhouettes, skin and clothing colors. `characters.png` is a compatible copy of the first avatar sheet. `avatars.json` contains the source and layout. The game also provides palette customization and glasses. Existing resident and teacher artwork remains in use.

`assets/manifest.json` records current image dimensions and SHA-256 checksums. `tools/finish_art.py` creates metadata and verifies map connectivity. That script does not rebuild all retained artwork.

## School accuracy and evidence

`data/school_evidence.json` distinguishes user-brief features from provisional game data. The name 서라벌여중 and the left-wing 90-degree bend are user-brief confirmed. Exact room order, dimensions, door and stair coordinates, facade details and furniture placement lack supplied current plans or photos and remain provisional. The supplied project contains **58 school room maps**, across four corridor maps, among **80 total maps**. There are 74 indoor room maps in total: 58 school rooms and 16 town interiors. The number 74 must not be described as 74 school rooms.

`docs/evidence/graphics-connectivity.json` records zero failures for all 80 maps: spawn reachability, interaction and NPC adjacency, portal targets, arrival bounds and arrival collision. These checks verify playable connectivity and do not prove real-world architectural accuracy.

Additional source photos, current floor plans, reference art comparison and physical school-tablet testing are still required for those acceptance criteria.

The production environment alpha was cleaned per cell to remove detached fringe fragments, and the final school screenshot was visually checked after that cleanup. This preserves the generated source separately.
