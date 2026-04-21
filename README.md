# Tienda Gamer - CRUD Productos
## Guía 5 - Bases de Datos | SQL Server + Node.js + Express

### Requisitos
- Node.js (v18+)
- SQL Server con la BD `tienda_gamer` ya creada

### Instalación

1. Abre una terminal en la carpeta del proyecto:
   ```
   cd tienda-gamer-crud
   ```

2. Instala las dependencias:
   ```
   npm install
   ```
   > Nota: `msnodesqlv8` puede tardar un poco porque compila código nativo.
   > Si da error, asegúrate de tener instaladas las "Build Tools" de Visual Studio
   > (se instalan con: npm install --global windows-build-tools)

3. Inicia el servidor:
   ```
   npm start
   ```

4. Abre el navegador en:
   ```
   http://localhost:3000
   ```

### Estructura del proyecto
```
tienda-gamer-crud/
├── package.json      ← dependencias
├── server.js         ← API Express + conexión SQL Server
├── public/
│   └── index.html    ← interfaz web (formulario + tabla)
└── README.md
```

### Endpoints de la API
| Método | Ruta                    | Acción                              |
|--------|-------------------------|-------------------------------------|
| GET    | /api/productos          | Listar todos los productos          |
| GET    | /api/productos/:id      | Obtener un producto por ID          |
| POST   | /api/productos          | Crear un producto nuevo             |
| PUT    | /api/productos/:id      | Actualizar un producto              |
| DELETE | /api/productos/:id      | Eliminar un producto                |
| GET    | /api/total-cliente/:id  | Total vendido (procedimiento alm.)  |
