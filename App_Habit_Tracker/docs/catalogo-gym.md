# Catálogo inicial de gimnasio y medidas

Es la propuesta de la fase 0, porque no tenías una rutina fija (respuesta 11). Todo es editable desde la app: puedes agregar, cambiar o archivar ejercicios, rutinas y tipos de medida.

> Esto es un punto de partida razonable, no asesoría profesional. Si en tu gimnasio hay alguien que te pueda corregir la técnica, aprovéchalo, sobre todo en sentadilla, peso muerto y press banca.

## Ejercicios (30)

El tipo es peso libre (PL), máquina o polea (M) o peso corporal (PC).

| Grupo | Ejercicio | Tipo |
| --- | --- | --- |
| Pecho | Press banca con barra | PL |
| Pecho | Press inclinado con mancuernas | PL |
| Pecho | Press de pecho en máquina | M |
| Pecho | Aperturas en polea | M |
| Pecho | Flexiones de brazos | PC |
| Espalda | Peso muerto convencional | PL |
| Espalda | Dominadas | PC |
| Espalda | Jalón al pecho | M |
| Espalda | Remo con barra | PL |
| Espalda | Remo con mancuerna a una mano | PL |
| Espalda | Remo sentado en polea | M |
| Hombros | Press militar con barra | PL |
| Hombros | Press de hombros con mancuernas | PL |
| Hombros | Elevaciones laterales con mancuernas | PL |
| Hombros | Face pull en polea | M |
| Bíceps | Curl con barra | PL |
| Bíceps | Curl martillo con mancuernas | PL |
| Tríceps | Extensión de tríceps en polea | M |
| Tríceps | Fondos en paralelas | PC |
| Tríceps | Press francés con barra Z | PL |
| Cuádriceps | Sentadilla con barra | PL |
| Cuádriceps | Prensa de piernas | M |
| Cuádriceps | Zancadas con mancuernas | PL |
| Cuádriceps | Extensión de cuádriceps | M |
| Isquiotibiales | Peso muerto rumano | PL |
| Isquiotibiales | Curl femoral en máquina | M |
| Glúteos | Hip thrust con barra | PL |
| Pantorrillas | Elevación de talones de pie | M |
| Core | Elevación de piernas colgado | PC |
| Core | Crunch en polea | M |

Quedaron fuera los ejercicios por tiempo, como la plancha, porque una serie se registra como repeticiones × peso. Si después los quieres, se agrega un campo de duración.

En los ejercicios de peso corporal, `weight_kg` es el peso **agregado** (0 si no usas lastre). En mancuernas es el peso de **una** mancuerna.

## Rutinas iniciales: cuerpo completo A/B

Elegí cuerpo completo A/B porque encaja con tu horario variable:

- Entrenas 2 o 3 veces por semana, alternando A y B, sin días fijos.
- Si un certamen te quita un día, la siguiente sesión es simplemente la otra letra. Ningún músculo queda dos semanas sin trabajo, como pasaría con una rutina dividida por grupos musculares.
- Se conecta con el hábito "Entrenar" como cuota semanal: 3 veces por semana, o 2 en semanas de certamen.

Las dos rutinas vienen como **contenido inicial también en producción**, igual que el catálogo, porque las vas a usar de verdad. Puedes editarlas o borrarlas. Los datos de prueba (check-ins y sesiones falsas) sí quedan solo en desarrollo (RF-5.2).

Esfuerzo sugerido: terminar cada serie con 2 o 3 repeticiones "en el estanque" (RPE 7–8). Cuando completas el tope del rango en todas las series, subes el peso en la sesión siguiente.

### Rutina A

| Ejercicio | Series × reps | Descanso |
| --- | --- | --- |
| Sentadilla con barra | 3 × 6–8 | 150 s |
| Press banca con barra | 3 × 6–8 | 150 s |
| Remo con barra | 3 × 8–10 | 120 s |
| Press de hombros con mancuernas | 2 × 10–12 | 90 s |
| Curl femoral en máquina | 2 × 10–12 | 90 s |
| Elevación de piernas colgado | 2 × 10–15 | 60 s |

### Rutina B

| Ejercicio | Series × reps | Descanso |
| --- | --- | --- |
| Peso muerto rumano | 3 × 8–10 | 150 s |
| Press inclinado con mancuernas | 3 × 8–10 | 120 s |
| Jalón al pecho | 3 × 8–12 | 120 s |
| Prensa de piernas | 2 × 10–12 | 120 s |
| Elevaciones laterales con mancuernas | 2 × 12–15 | 60 s |
| Extensión de tríceps en polea | 2 × 10–12 | 60 s |
| Curl martillo con mancuernas | 2 × 10–12 | 60 s |

Las sesiones duran unos 50–60 minutos con el calentamiento.

## Medidas corporales (respuesta 12: de ambos lados)

| Medida | Unidad | Frecuencia sugerida | Cómo medir |
| --- | --- | --- | --- |
| Peso | kg | Semanal, mismo día | En ayunas, después del baño, con la misma balanza |
| Cuello | cm | Mensual | Bajo la nuez, con la cinta horizontal |
| Pecho | cm | Mensual | A la altura de los pezones, después de exhalar normal |
| Cintura | cm | Mensual | A la altura del ombligo, relajado, sin meter el estómago |
| Cadera | cm | Mensual | En la parte más ancha de los glúteos |
| Brazo izquierdo / derecho | cm | Mensual | Punto medio entre el hombro y el codo, relajado |
| Muslo izquierdo / derecho | cm | Mensual | Punto medio entre la cadera y la rodilla, de pie |
| Pantorrilla izquierda / derecha | cm | Mensual | En la parte más ancha, de pie |

La app no te obliga a ninguna frecuencia: te muestra cuándo fue el último registro de cada medida. Los recordatorios quedan para la fase 7.
