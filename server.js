// =====================================================================
// server.js - API CRUD de Productos
// Tienda Gamer - Guía 5
// =====================================================================
const express = require('express');
const sql = require('mssql/msnodesqlv8'); // Driver nativo con ODBC Driver 17

const app = express();
const PORT = 3000;

// Middleware para leer JSON del frontend
app.use(express.json());

// Servir archivos estáticos (index.html)
app.use(express.static('public'));

// Shared Memory via (local) — no requiere TCP/IP habilitado
const dbConfig = {
    connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=(local);Database=tienda_gamer;Trusted_Connection=yes;'
};

// Pool de conexiones (se reutiliza en todas las rutas)
let pool;

async function conectarDB() {
    try {
        pool = await sql.connect(dbConfig);
        console.log('Conectado a SQL Server - tienda_gamer');
    } catch (err) {
        console.error('Error al conectar:', err.message);
        process.exit(1);
    }
}

// =====================================================================
// RUTAS API - CRUD DE PRODUCTOS
// =====================================================================

// LEER todos los productos
app.get('/api/productos', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT * FROM producto ORDER BY id_producto');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// LEER un producto por ID
app.get('/api/productos/:id', async (req, res) => {
    try {
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM producto WHERE id_producto = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREAR un producto nuevo
app.post('/api/productos', async (req, res) => {
    const { nombre, categoria, precio, stock } = req.body;

    // Validación básica
    if (!nombre || !categoria || precio == null || stock == null) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
        const result = await pool.request()
            .input('nombre', sql.VarChar(120), nombre)
            .input('categoria', sql.VarChar(20), categoria)
            .input('precio', sql.Decimal(12, 2), precio)
            .input('stock', sql.Int, stock)
            .query(`INSERT INTO producto (nombre, categoria, precio, stock)
                    VALUES (@nombre, @categoria, @precio, @stock);
                    SELECT SCOPE_IDENTITY() AS id_producto;`);

        res.status(201).json({
            mensaje: 'Producto creado',
            id_producto: result.recordset[0].id_producto
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ACTUALIZAR un producto
app.put('/api/productos/:id', async (req, res) => {
    const { nombre, categoria, precio, stock } = req.body;

    try {
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('nombre', sql.VarChar(120), nombre)
            .input('categoria', sql.VarChar(20), categoria)
            .input('precio', sql.Decimal(12, 2), precio)
            .input('stock', sql.Int, stock)
            .query(`UPDATE producto
                    SET nombre = @nombre, categoria = @categoria,
                        precio = @precio, stock = @stock
                    WHERE id_producto = @id`);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json({ mensaje: 'Producto actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ELIMINAR un producto
app.delete('/api/productos/:id', async (req, res) => {
    try {
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM producto WHERE id_producto = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json({ mensaje: 'Producto eliminado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =====================================================================
// RUTA EXTRA: Llamar al procedimiento almacenado desde la API
// =====================================================================
app.get('/api/total-cliente/:id', async (req, res) => {
    try {
        const result = await pool.request()
            .input('id_cliente', sql.Int, req.params.id)
            .output('total', sql.Decimal(12, 2))
            .output('num_ventas', sql.Int)
            .execute('sp_total_vendido_cliente');

        res.json({
            total: result.output.total,
            num_ventas: result.output.num_ventas
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Iniciar servidor
conectarDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
});
