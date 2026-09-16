# Research: Additional Items for Non-Medication Inventory

This document summarizes research used to expand the suggested subtypes for each category. Sources include WHO essential equipment lists, primary care and hospital supply lists, and healthcare office administration guides.

## Sources

- **WHO**: Generic Essential Emergency Equipment List; Core medical equipment (WHO-HSS-EHT-DIM-11.03); Interagency list for reproductive, maternal, newborn and child health.
- **Primary care / diagnostic**: Stethoscope, BP equipment, thermometer, otoscope, ophthalmoscope; spirometer, Holter monitor, fetal monitors; urine/blood analyzers, X-ray.
- **Surgical / OR**: Resuscitation and airway (resuscitator bags, laryngoscopes, oropharyngeal airways); suction, oxygen; surgical instruments (retractors, needle holders, cautery); surgical tables, utility carts; NG tubes, chest tube sets.
- **Consumables / PPE**: WHO renewable lists (NG tubes, IV sets, cannulas, syringes, needles, sutures, catheters, splints); PPE (gloves, masks, gowns, eye protection); sharps and waste containers; wound care (gauze, alcohol pads, hydrogen peroxide, bandages, medical tape, tweezers).
- **Office / admin**: Medical record binders, dividers, manila folders, file guides; patient/registration/claim/consent forms; letterhead, prescription pads, business cards; clipboards, calculators, labels, storage cabinets; card scanners, cleaning/disinfectant for admin areas.

## Additions Applied

The following additions have been incorporated into `lib/constants/non-medication-inventory.ts`:

### Medical Equipment
- Resuscitator bag (adult/paediatric), Oxygen mask and tubing, Suction catheter, Oropharyngeal airway, Laryngoscope, Endotracheal tubes, Vaginal speculum, Sterilizer/Autoclave, Spirometer, Holter monitor, Fetal monitor, Surgical table, Utility cart, Splints.

### Diagnostic Equipment
- Sphygmomanometer, X-ray machine, Blood analyzer, Urine analyzer, Laryngoscope, Speculum (vaginal/nasal).

### Surgical & Procedure Equipment
- Retractors, Needle holders, Cautery device, Nasogastric tubes, IV cannulas, Chest tube set, Sharps container, Waste/specimen containers.

### Personal Protective Gear
- N95 masks, Aprons, Eye protection (redundant with Goggles; kept for clarity).

### Patient Care Items
- Clipboards, Towels, Sanitary bins.

### Consumables and Supplies
- Alcohol pads, Hydrogen peroxide, Medical tape, Tweezers, Sharps containers, Waste disposal containers, Cotton balls, Nasogastric tubes, IV cannulas.

### Office Supplies
- Medical record binders, Dividers and file guides, Manila folders, Patient/registration forms, Letterhead, Prescription pads, Business cards, Clipboards, Calculators, Labels, Storage cabinets/shelves, Wastebaskets, Card scanners, Three-hole punch, Highlighters.

You can extend or trim these lists in `lib/constants/non-medication-inventory.ts` to match your facility’s actual stock.
