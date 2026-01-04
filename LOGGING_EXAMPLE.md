# Ejemplo de Logs del Sistema

Este documento muestra ejemplos de los logs que se generan cuando se procesa un mensaje de WhatsApp.

## Ejemplo 1: Usuario envía un gasto por texto

### Input del usuario:
```
"Gasté $50 en Uber ayer"
```

### Logs generados:

```
================================================================================
[KEBO-WA] 📨 INCOMING MESSAGE - 2025-01-04T10:30:45.123Z
================================================================================
Message ID: wamid.HBgNMTIzNDU2Nzg5MDEyMxUCABEYEjg3NjU0MzIxMDk4NzY1NDMyMQA=
From: 573001234567
Type: text
Has Text: true
Has Image: false
Conversation ID: conv_abc123xyz
Text Content: "Gasté $50 en Uber ayer"
================================================================================

================================================================================
[KEBO-WA] 🤖 AI PROCESSING & CATEGORY DECISION
================================================================================
Message ID: wamid.HBgNMTIzNDU2Nzg5MDEyMxUCABEYEjg3NjU0MzIxMDk4NzY1NDMyMQA=
Model: claude-haiku-4.5
Step Count: 2

User Message:
  "Gasté $50 en Uber ayer"

AI Response:
  "¡Listo! Registré tu gasto de transporte."

Tool Calls (1):

  [1] logExpense
      ├─ Category: TRANSPORTATION
      ├─ Description: Uber ride
      ├─ Amount: $50
      └─ Vendor: Uber

================================================================================

[KEBO-WA] 💾 EXPENSE SAVED - ID: exp_7f8g9h0i1j2k3l4m | Category: TRANSPORTATION | Amount: $50 | Description: "Uber ride"
[KEBO-WA] 🖼️  IMAGE GENERATED - Type: expense-added
[KEBO-WA] 📤 MESSAGE SENT - To: 573001234567 | Type: image
[KEBO-WA] 📤 MESSAGE SENT - To: 573001234567 | Type: text | Content: "¡Listo! Registré tu gasto de transporte."

--------------------------------------------------------------------------------
```

## Ejemplo 2: Usuario envía una imagen de recibo

### Input del usuario:
```
[Imagen de recibo] + Caption: "Almuerzo de hoy"
```

### Logs generados:

```
================================================================================
[KEBO-WA] 📨 INCOMING MESSAGE - 2025-01-04T12:15:30.456Z
================================================================================
Message ID: wamid.HBgNMTIzNDU2Nzg5MDEyMxUCABEYEjk4NzY1NDMyMTA5ODc2NTQzMjEA
From: 573001234567
Type: image
Has Text: true
Has Image: true
Conversation ID: conv_abc123xyz
Text Content: "Almuerzo de hoy"
================================================================================

[KEBO-WA] ℹ️  Downloading media from: https://api.kapso.ai/media/files/abc123xyz...
[KEBO-WA] ℹ️  Downloaded 245678 bytes
[KEBO-WA] ℹ️  Detected mime type: image/jpeg

================================================================================
[KEBO-WA] 🤖 AI PROCESSING & CATEGORY DECISION
================================================================================
Message ID: wamid.HBgNMTIzNDU2Nzg5MDEyMxUCABEYEjk4NzY1NDMyMTA5ODc2NTQzMjEA
Model: claude-haiku-4.5
Step Count: 2

User Message:
  "Almuerzo de hoy This is a receipt. Please extract the expense information and log it for me."

AI Response:
  "Got it!"

Tool Calls (1):

  [1] logExpense
      ├─ Category: FOOD_DINING
      ├─ Description: Lunch at El Corral
      ├─ Amount: $35.5
      └─ Vendor: El Corral

================================================================================

[KEBO-WA] 💾 EXPENSE SAVED - ID: exp_9k8j7h6g5f4d3s2a | Category: FOOD_DINING | Amount: $35.5 | Description: "Lunch at El Corral"
[KEBO-WA] 🖼️  IMAGE GENERATED - Type: expense-added
[KEBO-WA] 📤 MESSAGE SENT - To: 573001234567 | Type: image
[KEBO-WA] 📤 MESSAGE SENT - To: 573001234567 | Type: text | Content: "Got it!"

--------------------------------------------------------------------------------
```

## Ejemplo 3: Usuario solicita resumen de gastos

### Input del usuario:
```
"¿Cuánto he gastado esta semana?"
```

### Logs generados:

```
================================================================================
[KEBO-WA] 📨 INCOMING MESSAGE - 2025-01-04T18:45:12.789Z
================================================================================
Message ID: wamid.HBgNMTIzNDU2Nzg5MDEyMxUCABEYEjEyMzQ1Njc4OTA5ODc2NTQzMjEA
From: 573001234567
Type: text
Has Text: true
Has Image: false
Conversation ID: conv_abc123xyz
Text Content: "¿Cuánto he gastado esta semana?"
================================================================================

================================================================================
[KEBO-WA] 🤖 AI PROCESSING & CATEGORY DECISION
================================================================================
Message ID: wamid.HBgNMTIzNDU2Nzg5MDEyMxUCABEYEjEyMzQ1Njc4OTA5ODc2NTQzMjEA
Model: claude-haiku-4.5
Step Count: 2

User Message:
  "¿Cuánto he gastado esta semana?"

AI Response:
  "Here's your spending summary for this week!"

Tool Calls (1):

  [1] getExpensesSummary

================================================================================

[KEBO-WA] 🖼️  IMAGE GENERATED - Type: summary
[KEBO-WA] 📤 MESSAGE SENT - To: 573001234567 | Type: image
[KEBO-WA] 📤 MESSAGE SENT - To: 573001234567 | Type: text | Content: "Here's your spending summary for this week!"

--------------------------------------------------------------------------------
```

## Ejemplo 4: Error en el procesamiento

### Logs de error:

```
================================================================================
[KEBO-WA] 📨 INCOMING MESSAGE - 2025-01-04T20:00:00.000Z
================================================================================
Message ID: wamid.HBgNMTIzNDU2Nzg5MDEyMxUCABEYEjk5OTk5OTk5OTk5OTk5OTk5OQA=
From: 573001234567
Type: text
Has Text: true
Has Image: false
Text Content: "Compré algo"
================================================================================

[KEBO-WA] ❌ ERROR in POST /webhook:
Error: Database connection failed
    at getDb (file:///app/src/db/index.ts:45:10)
    at saveExpense (file:///app/src/app/api/kapso/webhook/route.ts:268:15)
    ...

[KEBO-WA] 📤 MESSAGE SENT - To: 573001234567 | Type: text | Content: "Error message sent to user"
```

## Beneficios del Sistema de Logging

1. **Trazabilidad completa**: Cada mensaje tiene un ID único que permite seguirlo a través de todo el pipeline
2. **Decisión de categoría visible**: Se puede ver exactamente qué categoría eligió la IA y por qué
3. **Debugging facilitado**: Los logs estructurados hacen fácil identificar dónde ocurre un problema
4. **Métricas**: Se pueden extraer métricas de performance y uso del sistema
5. **Auditoría**: Registro completo de todas las interacciones y decisiones del sistema
