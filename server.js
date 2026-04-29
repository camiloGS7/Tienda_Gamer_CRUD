// =====================================================================
// server.js - Dashboard API - Tienda Gamer
// =====================================================================
const express = require('express');
const sql = require('mssql/msnodesqlv8');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

const dbConfig = {
    connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=(local);Database=tienda_gamer;Trusted_Connection=yes;'
};

let pool;

async function conectarDB() {
    while (true) {
        try {
            pool = await sql.connect(dbConfig);
            console.log('✔ Conectado a SQL Server - tienda_gamer');
            return;
        } catch (err) {
            console.error('✘ ERROR DE CONEXIÓN ODBC:', err.message);
            console.error('  Cadena:', dbConfig.connectionString);
            console.error('  Reintentando en 3 segundos...');
            await new Promise(r => setTimeout(r, 3000));
        }
    }
}

// ===== DASHBOARD =====
app.get('/api/dashboard', async (req, res) => {
    try {
        const totales = await pool.request().query(`
            SELECT
                (SELECT COUNT(*) FROM producto)   AS total_productos,
                (SELECT COUNT(*) FROM cliente)    AS total_clientes,
                (SELECT COUNT(*) FROM empleado)   AS total_empleados,
                (SELECT COUNT(*) FROM venta)      AS total_ventas,
                (SELECT ISNULL(SUM(cantidad * precio_unitario), 0) FROM venta_detalle) AS total_ingresos
        `);
        const ultimas = await pool.request().query(`
            SELECT TOP 5
                v.id_venta,
                c.nombre AS cliente,
                e.nombre AS empleado,
                v.fecha,
                SUM(vd.cantidad * vd.precio_unitario) AS total
            FROM venta v
            JOIN cliente      c  ON v.id_cliente  = c.id_cliente
            JOIN empleado     e  ON v.id_empleado = e.id_empleado
            JOIN venta_detalle vd ON v.id_venta   = vd.id_venta
            GROUP BY v.id_venta, c.nombre, e.nombre, v.fecha
            ORDER BY v.fecha DESC
        `);
        res.json({ totales: totales.recordset[0], ultimas_ventas: ultimas.recordset });
    } catch (err) {
        console.error(`[${req.method} ${req.path}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// ===== PRODUCTOS =====
app.get('/api/productos', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT * FROM producto ORDER BY id_producto');
        res.json(result.recordset);
    } catch (err) {
        console.error(`[${req.method} ${req.path}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/productos', async (req, res) => {
    const { nombre, categoria, precio, stock } = req.body;
    if (!nombre || !categoria || precio == null || stock == null)
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    try {
        const result = await pool.request()
            .input('nombre',    sql.VarChar(120),   nombre)
            .input('categoria', sql.VarChar(20),    categoria)
            .input('precio',    sql.Decimal(12, 2), precio)
            .input('stock',     sql.Int,            stock)
            .query(`INSERT INTO producto (nombre, categoria, precio, stock)
                    VALUES (@nombre, @categoria, @precio, @stock);
                    SELECT SCOPE_IDENTITY() AS id_producto;`);
        res.status(201).json({ mensaje: 'Producto creado', id_producto: result.recordset[0].id_producto });
    } catch (err) {
        console.error(`[${req.method} ${req.path}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/productos/:id', async (req, res) => {
    const { nombre, categoria, precio, stock } = req.body;
    try {
        const result = await pool.request()
            .input('id',        sql.Int,            req.params.id)
            .input('nombre',    sql.VarChar(120),   nombre)
            .input('categoria', sql.VarChar(20),    categoria)
            .input('precio',    sql.Decimal(12, 2), precio)
            .input('stock',     sql.Int,            stock)
            .query(`UPDATE producto
                    SET nombre=@nombre, categoria=@categoria, precio=@precio, stock=@stock
                    WHERE id_producto=@id`);
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json({ mensaje: 'Producto actualizado' });
    } catch (err) {
        console.error(`[${req.method} ${req.path}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/productos/:id', async (req, res) => {
    try {
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM producto WHERE id_producto = @id');
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json({ mensaje: 'Producto eliminado' });
    } catch (err) {
        console.error(`[${req.method} ${req.path}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// ===== CLIENTES =====
app.get('/api/clientes', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT * FROM cliente ORDER BY id_cliente
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error(`[${req.method} ${req.path}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/clientes', async (req, res) => {
    const { nombre, email, telefono } = req.body;
    if (!nombre || !email)
        return res.status(400).json({ error: 'Nombre y email son obligatorios' });
    try {
        const result = await pool.request()
            .input('nombre',   sql.VarChar(100), nombre)
            .input('email',    sql.VarChar(120), email)
            .input('telefono', sql.VarChar(20),  telefono || null)
            .query(`INSERT INTO cliente (nombre, email, telefono) VALUES (@nombre, @email, @telefono);
                    SELECT SCOPE_IDENTITY() AS id_cliente;`);
        res.status(201).json({ mensaje: 'Cliente creado', id_cliente: result.recordset[0].id_cliente });
    } catch (err) {
        console.error('POST /api/clientes error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// SP con OUTPUT para un cliente específico
app.get('/api/total-cliente/:id', async (req, res) => {
    try {
        const result = await pool.request()
            .input('id_cliente',  sql.Int,            req.params.id)
            .output('total',      sql.Decimal(12, 2))
            .output('num_ventas', sql.Int)
            .execute('sp_total_vendido_cliente');
        res.json({ total: result.output.total, num_ventas: result.output.num_ventas });
    } catch (err) {
        console.error(`[${req.method} ${req.path}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// ===== EMPLEADOS =====
app.get('/api/empleados', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT * FROM empleado ORDER BY id_empleado');
        res.json(result.recordset);
    } catch (err) {
        console.error(`[${req.method} ${req.path}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/empleados', async (req, res) => {
    const { nombre, cargo, salario } = req.body;
    if (!nombre || !cargo) return res.status(400).json({ error: 'Nombre y cargo son obligatorios' });
    try {
        const result = await pool.request()
            .input('nombre',  sql.VarChar(100),   nombre)
            .input('cargo',   sql.VarChar(50),    cargo)
            .input('salario', sql.Decimal(12, 2), salario || null)
            .query(`INSERT INTO empleado (nombre, cargo, salario) VALUES (@nombre, @cargo, @salario);
                    SELECT SCOPE_IDENTITY() AS id_empleado;`);
        res.status(201).json({ mensaje: 'Empleado creado', id_empleado: result.recordset[0].id_empleado });
    } catch (err) {
        console.error(`[${req.method} ${req.path}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/empleados/:id', async (req, res) => {
    const { nombre, cargo, salario } = req.body;
    try {
        const result = await pool.request()
            .input('id',      sql.Int,            req.params.id)
            .input('nombre',  sql.VarChar(100),   nombre)
            .input('cargo',   sql.VarChar(50),    cargo)
            .input('salario', sql.Decimal(12, 2), salario || null)
            .query(`UPDATE empleado SET nombre=@nombre, cargo=@cargo, salario=@salario WHERE id_empleado=@id`);
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Empleado no encontrado' });
        res.json({ mensaje: 'Empleado actualizado' });
    } catch (err) {
        console.error(`[${req.method} ${req.path}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/empleados/:id', async (req, res) => {
    try {
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM empleado WHERE id_empleado = @id');
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Empleado no encontrado' });
        res.json({ mensaje: 'Empleado eliminado' });
    } catch (err) {
        console.error(`[${req.method} ${req.path}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// ===== VENTAS =====
app.get('/api/ventas', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT
                v.id_venta,
                v.fecha,
                c.nombre AS cliente,
                e.nombre AS empleado,
                SUM(vd.cantidad * vd.precio_unitario) AS total
            FROM venta v
            INNER JOIN cliente       c  ON v.id_cliente  = c.id_cliente
            INNER JOIN empleado      e  ON v.id_empleado = e.id_empleado
            INNER JOIN venta_detalle vd ON v.id_venta    = vd.id_venta
            GROUP BY v.id_venta, v.fecha, c.nombre, e.nombre
            ORDER BY v.fecha DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error(`[${req.method} ${req.path}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/ventas', async (req, res) => {
    const { id_cliente, id_empleado, id_producto, cantidad } = req.body;
    if (!id_cliente || !id_empleado || !id_producto || !cantidad)
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    try {
        const result = await pool.request()
            .input('id_cliente',       sql.Int, id_cliente)
            .input('id_empleado',      sql.Int, id_empleado)
            .input('id_producto',      sql.Int, id_producto)
            .input('cantidad',         sql.Int, cantidad)
            .output('id_venta_creada', sql.Int)
            .execute('sp_registrar_venta');
        res.status(201).json({ mensaje: 'Venta registrada', id_venta: result.output.id_venta_creada });
    } catch (err) {
        // Errores del SP (stock insuficiente, etc.) → 400, no 500
        console.error(`[POST /api/ventas] SP error:`, err.message);
        res.status(400).json({ error: err.message });
    }
});

// ===== FACTURA (usa funciones SQL) =====
app.get('/api/factura/:id_venta', async (req, res) => {
    try {
        const result = await pool.request()
            .input('id', sql.Int, req.params.id_venta)
            .query(`
                SELECT
                    v.id_venta,
                    v.fecha,
                    c.nombre AS cliente,
                    e.nombre AS empleado,
                    SUM(vd.cantidad * vd.precio_unitario)              AS subtotal,
                    dbo.fn_calcular_iva(SUM(vd.cantidad * vd.precio_unitario)) AS iva,
                    dbo.fn_total_factura_con_iva(@id)                  AS total_con_iva
                FROM venta v
                INNER JOIN cliente       c  ON v.id_cliente  = c.id_cliente
                INNER JOIN empleado      e  ON v.id_empleado = e.id_empleado
                INNER JOIN venta_detalle vd ON v.id_venta    = vd.id_venta
                WHERE v.id_venta = @id
                GROUP BY v.id_venta, v.fecha, c.nombre, e.nombre
            `);
        if (result.recordset.length === 0)
            return res.status(404).json({ error: 'Venta no encontrada' });
        res.json(result.recordset[0]);
    } catch (err) {
        console.error(`[${req.method} ${req.path}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// ===== AUDITORÍA =====
app.get('/api/auditoria', async (req, res) => {
    try {
        const result = await pool.request()
            .query('SELECT * FROM auditoria_empleado ORDER BY fecha DESC');
        res.json(result.recordset);
    } catch (err) {
        console.error(`[${req.method} ${req.path}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// Iniciar servidor
conectarDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
});
