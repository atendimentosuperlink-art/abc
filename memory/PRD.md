# Vistoria Diária do Veículo — PRD

## Overview
Native mobile app (Expo) for **daily vehicle inspection** in Brazilian Portuguese. Transformed from a self-contained PWA into a fully functional React Native / Expo Router application. Designed for fleet operators, drivers, and rental companies to record visual damage on vehicles before/after use.

## Core Functionality
- **Home / Dashboard**: list of past inspections (history), launch "New Inspection" CTA, export PDF & delete from list (long-press).
- **Inspection Canvas**:
  - Fields: Data, Placa, Condutor
  - Vehicle model selector chips (Uno Mille 4p 2005, Uno Mille 2p 2011, Palio 4p 2011 — preserved from the original PWA)
  - 5 view tabs: Topo, Frente, Traseira, Lateral Esquerda, Lateral Direita
  - Tap anywhere on the vehicle photo to drop a numbered, color-coded pin
  - Pins can be tapped again to edit (type, note, photo) via a bottom sheet
- **Marker Sheet (bottom sheet)**:
  - 5 damage types with their PWA colors: Ferrugem (#a8702f), Amassado (#4a90d9), Arranhão (#f2c94c), Quebrado (#e5484d), Outro (#9b9b9b)
  - Free-text note
  - Attach / replace / remove photo (Camera or Library)
  - Delete pin
- **Persistence**: AsyncStorage only (no backend, fully offline). Draft autosave + finalized history.
- **PDF Export**: generates an HTML report with the vehicle photos, overlaid pins, marker table and observations, then shares via the native share sheet (expo-print + expo-sharing).

## Design
- Dark industrial workshop aesthetic from the original PWA
- Background `#1c1c1e`, accent orange `#ff6b35`, paper tone `#e8e6e1` for the canvas
- Oswald-like condensed display headings (system-condensed on Android, Impact on iOS), monospace labels (Menlo/monospace), system body for notes
- Sharp borders, no glassmorphism, structural layout

## Tech Stack
- Expo SDK 54, Expo Router 6, React Native 0.81
- expo-image, expo-image-picker, expo-print, expo-sharing, expo-haptics
- AsyncStorage (local-only)
- No external integrations / no auth

## Not Included (per user request — "apenas o essencial")
- No authentication
- No cloud sync / no backend
- No signature, no GPS tagging, no extra metadata beyond date/plate/driver
