import { all, db, ensureBaseData, get, insert, run, setSettings, transaction, closeDb } from './db.js';
import { config } from './config.js';
import { isoDate, nowIso } from './utils.js';

const DAY = 86400000;
const now = new Date();

const atDays = (daysAgo, hour = 10) => {
  const date = new Date(now.getTime() - daysAgo * DAY);
  date.setHours(hour, 15, 0, 0);
  return date.toISOString();
};

const dayOnly = (daysAgo) => isoDate(new Date(now.getTime() - daysAgo * DAY));
const money = (value) => Math.round(Number(value) / 100) * 100;

function seedReference() {
  const technicians = [
    ['Lucas Herrera', '+54 11 5520-8841', 'Hardware y notebooks'],
    ['Martina Sosa', '+54 11 4381-2209', 'Celulares y tablets'],
    ['Diego Ramos', '+54 11 6632-9154', 'Consolas y electrónica'],
    ['Ariel Benítez', '+54 11 3044-7890', 'Redes e impresoras'],
  ];
  const technicianIds = technicians.map(([name, phone, specialty]) =>
    insert('INSERT INTO technicians (name, phone, specialty, created_at) VALUES (?, ?, ?, ?)', [
      name,
      phone,
      specialty,
      nowIso(),
    ]),
  );

  const suppliers = [
    ['TecnoPartes S.A.', 'Mariano López', '+54 11 4550-7720', 'ventas@tecnopartes.com', 'Av. Belgrano 2480, CABA', '30-71045678-4'],
    ['Insumos del Sur', 'Paula Medina', '+54 11 4462-1198', 'pedidos@insumosdelsur.com', 'Av. Boedo 1120, CABA', '30-70889123-1'],
    ['Mayorista Gamer', 'Santiago Ferro', '+54 11 5030-2284', 'compras@mayoristagamer.com', 'Av. Rivadavia 6800, CABA', '30-71654321-9'],
    ['Global Components', 'Nadia Soria', '+54 11 6789-4401', 'contacto@globalcomponents.com', 'Billinghurst 890, CABA', '30-70987654-2'],
  ];
  for (const supplier of suppliers) {
    insert(
      `INSERT INTO suppliers (name, contact_name, phone, email, address, cuit, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [...supplier, nowIso(), nowIso()],
    );
  }
  const supplierByName = Object.fromEntries(all('SELECT id, name FROM suppliers').map((row) => [row.name, row.id]));
  const categoryByName = Object.fromEntries(all('SELECT id, name FROM product_categories').map((row) => [row.name, row.id]));

  const products = [
    ['SSD Crucial BX500 480GB', 'Almacenamiento', 'Crucial', 'BX500', 'SSD-CRU-480', 12, 5, 38000, 62000, 'TecnoPartes S.A.', 'Estante A1'],
    ['SSD Kingston NV2 1TB', 'Almacenamiento', 'Kingston', 'NV2', 'SSD-KIN-1TB', 4, 6, 72000, 108000, 'TecnoPartes S.A.', 'Estante A2'],
    ['Memoria RAM Kingston Fury 8GB DDR4', 'Memorias RAM', 'Kingston', 'Fury Beast', 'RAM-KIN-8', 2, 5, 22000, 42000, 'Global Components', 'Cajón B2'],
    ['Memoria RAM Samsung 16GB DDR4', 'Memorias RAM', 'Samsung', 'M378A2K43', 'RAM-SAM-16', 0, 3, 48000, 78000, 'Global Components', 'Cajón B3'],
    ['Pantalla LED 15.6" 30 pines', 'Pantallas y displays', 'BOE', 'NT156FHM', 'PAN-156-30', 3, 2, 55000, 95000, 'TecnoPartes S.A.', 'Estante C1'],
    ['Batería Lenovo IdeaPad 3', 'Baterías', 'Lenovo', 'L19C3PF5', 'BAT-LEN-IP3', 1, 3, 48000, 85000, 'Insumos del Sur', 'Cajón D1'],
    ['Fuente ATX 550W 80 Plus Bronze', 'Fuentes y carga', 'Aerocool', 'VX-550', 'FUE-AER-550', 5, 2, 40000, 68000, 'Global Components', 'Estante E1'],
    ['Cargador Notebook USB-C 65W', 'Fuentes y carga', 'Lenovo', 'ADLX65YLC3D', 'CAR-LEN-65', 8, 4, 28000, 52000, 'Insumos del Sur', 'Cajón E2'],
    ['Teclado Notebook HP 15', 'Periféricos', 'HP', 'TPN-Q222', 'TEC-HP-15', 4, 2, 30000, 57000, 'TecnoPartes S.A.', 'Estante F1'],
    ['Cooler CPU universal', 'Refrigeración', 'Cooler Master', 'Hyper 212', 'COO-CM-212', 7, 3, 12000, 26000, 'Global Components', 'Cajón G1'],
    ['Pasta térmica Arctic MX-4 4g', 'Insumos de limpieza', 'Arctic', 'MX-4', 'INS-ARC-MX4', 18, 8, 4500, 9500, 'Insumos del Sur', 'Cajón H1'],
    ['Kit destornilladores precisión 25 en 1', 'Otros', 'Genius', 'TK-25', 'HER-GEN-25', 5, 2, 18000, 36000, 'Insumos del Sur', 'Depósito 1'],
    ['Cable HDMI 2.1 2 metros', 'Cables y adaptadores', 'Ugreen', 'HD135', 'CAB-UGR-HD2', 14, 5, 3500, 7800, 'Global Components', 'Cajón I1'],
    ['Display iPhone 11', 'Consolas y móviles', 'Apple', 'iPhone 11', 'DIS-IP11', 2, 2, 55000, 98000, 'Mayorista Gamer', 'Vitrina M1'],
    ['Batería iPhone 11', 'Baterías', 'Apple', 'iPhone 11', 'BAT-IP11', 3, 2, 32000, 62000, 'Mayorista Gamer', 'Vitrina M2'],
    ['Joystick PS5 DualSense', 'Consolas y móviles', 'Sony', 'DualSense', 'JOY-SON-PS5', 1, 2, 98000, 145000, 'Mayorista Gamer', 'Vitrina M3'],
    ['Lector de tarjetas USB-C', 'Cables y adaptadores', 'Ugreen', 'CM304', 'LEC-UGR-304', 9, 4, 6000, 13000, 'Global Components', 'Cajón I2'],
    ['Adaptador NVMe USB-C', 'Cables y adaptadores', 'Ugreen', 'CM400', 'ADP-UGR-NVME', 4, 2, 15000, 29000, 'TecnoPartes S.A.', 'Cajón I3'],
  ];
  for (const [name, category, brand, model, sku, stock, minStock, purchase, sale, supplier, location] of products) {
    insert(
      `INSERT INTO products (name, category_id, brand, model, sku, stock, min_stock, purchase_price, sale_price,
        supplier_id, location, entry_date, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        name,
        categoryByName[category] || null,
        brand,
        model,
        sku,
        stock,
        minStock,
        purchase,
        sale,
        supplierByName[supplier] || null,
        location,
        dayOnly(180),
        nowIso(),
        nowIso(),
      ],
    );
  }

  return { technicianIds, supplierByName, categoryByName };
}

const CLIENTS = [
  ['Sofía', 'Martínez', '11 5032-8471', 'sofia.martinez@gmail.com', '38.452.117', 'Av. Cabildo 1840, CABA'],
  ['Juan Pablo', 'Gómez', '11 4488-1290', 'jpgomez@hotmail.com', '32.118.904', 'Rivadavia 5620, CABA'],
  ['Carla', 'Fernández', '11 6733-9021', 'carla.fer@gmail.com', '41.902.336', 'Av. Santa Fe 3210, CABA'],
  ['Martín', 'Rodríguez', '11 5567-2284', 'martin.rodriguez@gmail.com', '29.874.552', 'Lavalle 780, CABA'],
  ['Lucía', 'Benítez', '11 3098-7742', 'lucia.benitez@outlook.com', '36.701.245', 'Dorrego 1250, CABA'],
  ['Nicolás', 'Acosta', '11 4412-0098', 'nacosta@gmail.com', '40.223.779', 'Av. Corrientes 4450, CABA'],
  ['Valeria', 'Ríos', '11 6720-4419', 'valeria.rios@gmail.com', '34.990.212', 'Yerbal 2210, CABA'],
  ['Federico', 'Molina', '11 3388-1125', 'federico.molina@gmail.com', '31.552.830', 'Av. Rivadavia 8290, CABA'],
  ['Agustina', 'Pereira', '11 2255-9074', 'agus.pereira@gmail.com', '42.341.562', 'Gorriti 4180, CABA'],
  ['Ramiro', 'Quiroga', '11 5589-3410', 'ramiroq@hotmail.com', '28.676.443', 'Av. San Juan 2900, CABA'],
  ['Camila', 'Torres', '11 4477-8832', 'camila.torres@gmail.com', '39.108.554', 'Av. Pedro Goyena 1120, CABA'],
  ['Emiliano', 'Castro', '11 6690-1287', 'emiliano.castro@gmail.com', '33.291.867', 'Mendeville 2350, CABA'],
  ['Laura', 'Giménez', '11 3045-7791', 'laura.gimenez@gmail.com', '44.320.115', 'Av. La Plata 1560, CABA'],
  ['Tomás', 'Álvarez', '11 5612-7744', 'tomas.alvarez@gmail.com', '37.885.223', 'Av. Directorio 3380, CABA'],
];

const SCENARIOS = [
  ['Notebook', 'Lenovo', 'IdeaPad 3 15ALC', 'No enciende, quedó con luz de carga intermitente.', 'RECIBIDO', 85000, 0, 0, 0, 0, 'Sin diagnóstico aún.'],
  ['Celular', 'Samsung', 'Galaxy A54', 'Pantalla rota tras una caída.', 'PENDIENTE_DIAGNOSTICO', 120000, 0, 1, 1, 0, 'Sin diagnóstico aún.'],
  ['PC de escritorio', 'Armada', 'Ryzen 5 5600G', 'Se reinicia solo al abrir juegos.', 'EN_DIAGNOSTICO', 95000, 0, 2, 2, 1, 'Pruebas de estrés y revisión de fuente.'],
  ['Consola PlayStation', 'Sony', 'PlayStation 5', 'No lee discos, hace ruido.', 'PRESUPUESTADO', 180000, 0, 3, 0, 2, 'Lector óptico desgastado.'],
  ['Notebook', 'HP', 'Pavilion 15', 'Varias teclas no responden.', 'ESPERANDO_APROBACION', 75000, 0, 4, 0, 1, 'Teclado a reemplazar.'],
  ['Consola Xbox', 'Microsoft', 'Xbox Series S', 'Se apaga por sobrecalentamiento.', 'ESPERANDO_REPUESTOS', 110000, 0, 5, 0, 2, 'Requiere ventilador y mantenimiento.'],
  ['Monitor', 'LG', '24MP400', 'No enciende, led de standby apagado.', 'EN_REPARACION', 65000, 0, 6, 0, 0, 'Revisión de fuente interna.'],
  ['Impresora', 'Epson', 'L3250', 'Imprime con líneas y no toma hojas.', 'EN_PRUEBAS', 55000, 0, 7, 0, 3, 'Limpieza de cabezal y rodillos.'],
  ['All in One', 'HP', '22-df0007la', 'Está muy lenta y se bloquea.', 'REPARADO', 90000, 0, 9, 0, 0, 'Cambio de disco y limpieza general.'],
  ['Notebook', 'Asus', 'VivoBook X515', 'La batería no dura más de 20 minutos.', 'LISTO_PARA_RETIRAR', 98000, 0, 10, 0, 1, 'Batería reemplazada.'],
  ['Celular', 'Apple', 'iPhone 11', 'Pantalla sin imagen, táctil funciona.', 'LISTO_PARA_RETIRAR', 185000, 0, 11, 0, 2, 'Display reemplazado.'],
  ['PC de escritorio', 'Gamer', 'Ryzen 7 5800X', 'Se apaga de golpe cuando exige la placa.', 'ENTREGADO', 145000, 145000, 40, 0, 1, 6],
  ['Notebook', 'Dell', 'Inspiron 3505', 'No arranca el sistema operativo.', 'ENTREGADO', 120000, 120000, 55, 0, 0, 18],
  ['Consola PlayStation', 'Sony', 'PlayStation 4 Slim', 'Se calienta y apaga.', 'ENTREGADO', 70000, 70000, 70, 2, 2, 2],
  ['Tablet', 'Samsung', 'Galaxy Tab A8', 'No carga y el pin está flojo.', 'ENTREGADO', 85000, 85000, 90, 4, 1, 9],
  ['Impresora', 'HP', 'LaserJet M404dn', 'Hace ruido y deja manchas.', 'ENTREGADO', 160000, 160000, 120, 6, 3, 95],
  ['Celular', 'Motorola', 'Moto G54', 'No carga luego de mojarse.', 'SIN_REPARACION', 45000, 0, 25, 8, 2, 0],
  ['Consola Xbox', 'Microsoft', 'Xbox One S', 'No da imagen por HDMI.', 'CANCELADO', 130000, 0, 30, 9, 2, 0],
  ['Notebook', 'Lenovo', 'ThinkPad T14', 'Pantalla partida, equipo funciona.', 'EN_REPARACION', 210000, 0, 8, 0, 1, 0],
  ['PC de escritorio', 'HP', 'EliteDesk 800 G3', 'No enciende.', 'ESPERANDO_REPUESTOS', 78000, 0, 6, 5, 0, 0],
  ['Netbook', 'Exo', 'Smart One C14', 'No enciende, cargador enciende.', 'PENDIENTE_DIAGNOSTICO', 60000, 0, 2, 2, 0, 0],
  ['Celular', 'Xiaomi', 'Redmi Note 12', 'Se descarga muy rápido.', 'EN_DIAGNOSTICO', 70000, 0, 3, 7, 2, 0],
  ['Monitor', 'Samsung', 'Odyssey G3 27"', 'Aparecen líneas horizontales.', 'RECIBIDO', 50000, 0, 0, 0, 3, 0],
  ['Notebook', 'Acer', 'Aspire 5', 'La bisagra izquierda está rota.', 'PRESUPUESTADO', 95000, 0, 5, 0, 1, 0],
  ['Consola PlayStation', 'Sony', 'PlayStation 4 Slim', 'No enciende, no hace ningún sonido.', 'EN_PRUEBAS', 85000, 0, 11, 0, 2, 0],
  ['All in One', 'Lenovo', 'IdeaCentre AIO 3', 'No encuentra el disco de arranque.', 'REPARADO', 110000, 0, 13, 0, 0, 0],
  ['Tablet', 'Apple', 'iPad 9na gen', 'El táctil no responde en el borde.', 'LISTO_PARA_RETIRAR', 135000, 0, 14, 0, 2, 0],
  ['PC de escritorio', 'Intel', 'Core i5 10400', 'Quiere agregar SSD y más memoria.', 'ENTREGADO', 95000, 95000, 100, 0, 0, 82],
  ['Notebook', 'HP', 'Pavilion Gaming 15', 'No enciende después de una descarga.', 'ENTREGADO', 155000, 155000, 140, 0, 1, 118],
  ['Celular', 'Samsung', 'Galaxy A14', 'Cámara trasera no enfoca.', 'ESPERANDO_APROBACION', 65000, 0, 7, 11, 2, 0],
  ['Impresora', 'Brother', 'DCP-T520W', 'No escanea desde la computadora.', 'RECIBIDO', 45000, 0, 0, 0, 3, 0],
  ['Componente informático', 'Asus', 'Prime B450M', 'Revisión de motherboard con dos pines doblados.', 'PENDIENTE_DIAGNOSTICO', 40000, 0, 2, 4, 0, 0],
  ['Consola Xbox', 'Microsoft', 'Xbox Series X', 'No da imagen y se apaga a los segundos.', 'EN_REPARACION', 190000, 0, 9, 0, 2, 0],
  ['Notebook', 'Lenovo', 'IdeaPad 5', 'El teclado escribe caracteres incorrectos.', 'ENTREGADO', 88000, 88000, 75, 0, 1, 52],
  ['Celular', 'Apple', 'iPhone 13', 'La batería se hinchó.', 'ENTREGADO', 120000, 120000, 50, 0, 2, 28],
  ['Monitor', 'Philips', '241V8L', 'No enciende y huele a quemado.', 'ESPERANDO_REPUESTOS', 70000, 0, 12, 13, 2, 0],
];

// Días transcurridos desde la entrega para las órdenes ya entregadas (índice del escenario).
const DELIVERED_DAYS = {
  11: 6,
  12: 18,
  13: 2,
  14: 9,
  15: 95,
  27: 82,
  28: 118,
  33: 52,
  34: 28,
};

const ACCESSORIES = [  'Cargador original',
  'Cargador y cable USB',
  'Funda y cargador',
  'Sin accesorios',
  'Cargador, mouse y teclado',
  'Cable de alimentación',
  'Control inalámbrico',
  'Funda, cargador y auriculares',
];

function seedDemo() {
  if (get('SELECT COUNT(*) AS count FROM orders').count > 0) {
    return { seeded: false, reason: 'La base ya contiene órdenes.' };
  }

  const { technicianIds } = seedReference();
  const clientIds = CLIENTS.map(([firstName, lastName, phone, email, dni, address]) =>
    insert(
      `INSERT INTO clients (first_name, last_name, phone, phone_normalized, email, dni, address, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [firstName, lastName, phone, phone.replace(/\D/g, ''), email, dni, address, nowIso(), nowIso()],
    ),
  );
  const typeIds = Object.fromEntries(all('SELECT id, name FROM equipment_types').map((row) => [row.name, row.id]));
  const products = all('SELECT * FROM products ORDER BY id');
  const admin = get('SELECT id FROM users ORDER BY id LIMIT 1');
  const currentYear = now.getFullYear();

  const createdOrders = [];
  transaction(() => {
    SCENARIOS.forEach((scenario, index) => {
      const [
        typeName,
        brand,
        model,
        issue,
        status,
        budget,
        finalPrice,
        intakeDays,
        techIndex,
        deliveredDays,
      ] = scenario;
      const rawNotes = scenario[10];
      const notes =
        typeof rawNotes === 'string' && rawNotes.length > 2
          ? rawNotes
          : 'Se completó el diagnóstico y la reparación acordada.';
      const clientId = clientIds[index % clientIds.length];
      const technicianId = technicianIds[techIndex % technicianIds.length];
      const intakeAt = atDays(intakeDays, 9 + (index % 7));
      const deliveredAt =
        status === 'ENTREGADO' ? atDays(DELIVERED_DAYS[index] ?? 1, 17) : null;
      const estimatedDelivery = dayOnly(intakeDays - 10);
      const cancellationReason = status === 'CANCELADO' ? 'El cliente decidió no continuar con la reparación.' : null;
      const orderId = insert(
        `INSERT INTO orders (
          order_number, client_id, equipment_type_id, brand, model, serial_number, imei, color, accessories,
          unlock_type, unlock_secret_enc, intake_at, declared_issue, detailed_problem, physical_condition,
          visible_damage, initial_diagnosis, technician_id, status, priority, estimated_budget,
          estimated_delivery, internal_notes, labor_cost, final_price, cancellation_reason,
          created_by, created_at, updated_at, delivered_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          NULL,
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )`,
        [
          `OT-${currentYear}-${String(index + 1).padStart(4, '0')}`,
          clientId,
          typeIds[typeName] || typeIds['Otro dispositivo electrónico'],
          brand,
          model,
          `${brand.slice(0, 2).toUpperCase()}${String(2024000 + index * 37)}`,
          typeName === 'Celular' ? `356789${String(100000 + index * 73)}` : null,
          ['Negro', 'Gris', 'Blanco', 'Azul', 'Plateado'][index % 5],
          ACCESSORIES[index % ACCESSORIES.length],
          typeName === 'Celular' || typeName === 'Tablet' ? 'Patrón de desbloqueo' : null,
          intakeAt,
          issue,
          `${issue} El equipo fue recibido para revisión. Se informó al cliente que el diagnóstico inicial puede variar al desarmar el equipo.`,
          ['Buen estado general', 'Rayones leves en la carcasa', 'Golpes visibles en una esquina', 'Carcasa con desgaste', 'Pantalla con marca'][index % 5],
          index % 4 === 0 ? 'Golpe visible en la tapa inferior. No se observan daños por líquido.' : null,
          status === 'RECIBIDO' || status === 'PENDIENTE_DIAGNOSTICO' ? null : notes,
          technicianId,
          status,
          ['NORMAL', 'NORMAL', 'ALTA', 'URGENTE'][index % 4],
          budget,
          estimatedDelivery,
          'Equipo recibido con contraseña protegida. No revelar al cliente sin autorización.',
          finalPrice ? Math.round(finalPrice * 0.18) : 0,
          finalPrice,
          cancellationReason,
          admin.id,
          intakeAt,
          deliveredAt || atDays(Math.max(0, intakeDays - 1), 12),
          deliveredAt,
        ],
      );

      insert(
        `INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by, created_at)
         VALUES (?, NULL, 'RECIBIDO', 'Ingreso del equipo al taller.', ?, ?)`,
        [orderId, admin.id, intakeAt],
      );
      if (status !== 'RECIBIDO') {
        const finalHistoryAt = deliveredAt || atDays(Math.max(0, intakeDays - 1), 15);
        insert(
          `INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by, created_at)
           VALUES (?, 'RECIBIDO', ?, ?, ?, ?)`,
          [orderId, status, notes || 'Actualización de estado.', admin.id, finalHistoryAt],
        );
      }
      if (!['RECIBIDO', 'PENDIENTE_DIAGNOSTICO'].includes(status)) {
        insert(
          `INSERT INTO order_interventions (order_id, type, description, technician_id, created_by, created_at)
           VALUES (?, 'DIAGNOSTICO', ?, ?, ?, ?)`,
          [
            orderId,
            `${notes}. Se realizaron pruebas de funcionamiento y revisión visual interna.`,
            technicianId,
            admin.id,
            atDays(Math.max(0, intakeDays - 2), 11),
          ],
        );
      }
      if (['EN_REPARACION', 'EN_PRUEBAS', 'REPARADO', 'LISTO_PARA_RETIRAR', 'ENTREGADO'].includes(status)) {
        insert(
          `INSERT INTO order_interventions (order_id, type, description, technician_id, created_by, created_at)
           VALUES (?, 'REPARACION', ?, ?, ?, ?)`,
          [
            orderId,
            'Se realizó la reparación acordada, limpieza interna y prueba de estabilidad.',
            technicianId,
            admin.id,
            deliveredAt || atDays(Math.max(0, intakeDays - 4), 16),
          ],
        );
      }

      const billable = finalPrice || budget;
      if (!['CANCELADO', 'RECIBIDO', 'SIN_REPARACION'].includes(status) && billable > 0) {
        const deposit = money(billable * 0.3);
        const depositAt = atDays(Math.max(0, intakeDays - 1), 10);
        const paymentId = insert(
          `INSERT INTO payments (order_id, client_id, amount, method, payment_type, reference, notes, received_at, created_by, created_at)
           VALUES (?, ?, ?, ?, 'SENA', ?, 'Seña recibida al aprobar el presupuesto.', ?, ?, ?)`,
          [orderId, clientId, deposit, index % 3 === 0 ? 'TRANSFERENCIA' : 'EFECTIVO', `SENA-${index + 1}`, depositAt, admin.id, depositAt],
        );
        insert(
          `INSERT INTO transactions (type, category, description, amount, method, transaction_date, order_id, payment_id, notes, created_by, created_at)
           VALUES ('INGRESO', 'Seña de reparación', ?, ?, ?, ?, ?, ?, 'Seña de reparación', ?, ?)`,
          [
            `Seña de la orden OT-${currentYear}-${String(index + 1).padStart(4, '0')}`,
            deposit,
            index % 3 === 0 ? 'TRANSFERENCIA' : 'EFECTIVO',
            isoDate(depositAt),
            orderId,
            paymentId,
            admin.id,
            depositAt,
          ],
        );

        if (status === 'ENTREGADO' && finalPrice > deposit) {
          const finalAmount = finalPrice - deposit;
          const paymentId2 = insert(
            `INSERT INTO payments (order_id, client_id, amount, method, payment_type, reference, notes, received_at, created_by, created_at)
             VALUES (?, ?, ?, ?, 'PAGO_FINAL', ?, 'Saldo abonado al retirar el equipo.', ?, ?, ?)`,
            [orderId, clientId, finalAmount, 'TARJETA', `SALDO-${index + 1}`, deliveredAt, admin.id, deliveredAt],
          );
          insert(
            `INSERT INTO transactions (type, category, description, amount, method, transaction_date, order_id, payment_id, notes, created_by, created_at)
             VALUES ('INGRESO', 'Cobro final de reparación', ?, ?, 'TARJETA', ?, ?, ?, 'Saldo final de reparación', ?, ?)`,
            [
              `Saldo final de la orden OT-${currentYear}-${String(index + 1).padStart(4, '0')}`,
              finalAmount,
              isoDate(deliveredAt),
              orderId,
              paymentId2,
              admin.id,
              deliveredAt,
            ],
          );
        } else if (['EN_PRUEBAS', 'REPARADO', 'LISTO_PARA_RETIRAR'].includes(status) && status !== 'ENTREGADO') {
          const partial = money((billable - deposit) * 0.35);
          if (partial > 0) {
            const paymentId2 = insert(
              `INSERT INTO payments (order_id, client_id, amount, method, payment_type, reference, notes, received_at, created_by, created_at)
               VALUES (?, ?, ?, 'MERCADO_PAGO', 'PAGO_PARCIAL', ?, 'Pago parcial acordado.', ?, ?, ?)`,
              [orderId, clientId, partial, `PARC-${index + 1}`, atDays(Math.max(0, intakeDays - 3), 13), admin.id, atDays(Math.max(0, intakeDays - 3), 13)],
            );
            insert(
              `INSERT INTO transactions (type, category, description, amount, method, transaction_date, order_id, payment_id, notes, created_by, created_at)
               VALUES ('INGRESO', 'Pago de reparación', ?, ?, 'MERCADO_PAGO', ?, ?, ?, 'Pago parcial', ?, ?)`,
              [
                `Pago parcial de la orden OT-${currentYear}-${String(index + 1).padStart(4, '0')}`,
                partial,
                isoDate(atDays(Math.max(0, intakeDays - 3), 13)),
                orderId,
                paymentId2,
                admin.id,
                atDays(Math.max(0, intakeDays - 3), 13),
              ],
            );
          }
        }
      }

      if (['EN_REPARACION', 'EN_PRUEBAS', 'REPARADO', 'LISTO_PARA_RETIRAR', 'ENTREGADO'].includes(status)) {
        let product = null;
        if (typeName === 'Notebook') product = products[index % 2 === 0 ? 0 : 8];
        else if (typeName === 'Celular') product = products[index % 2 === 0 ? 13 : 14];
        else if (typeName === 'PC de escritorio' || typeName === 'All in One') product = products[index % 2 === 0 ? 6 : 2];
        else if (typeName === 'Consola PlayStation' || typeName === 'Consola Xbox') product = products[9];
        else if (typeName === 'Monitor') product = products[6];
        if (product && product.stock > 0) {
          const quantity = 1;
          const stockAfter = Number(product.stock) - quantity;
          insert(
            `INSERT INTO order_parts (order_id, product_id, quantity, unit_cost, unit_price, notes, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, 'Repuesto utilizado en la reparación.', ?, ?)`,
            [orderId, product.id, quantity, product.purchase_price, product.sale_price, admin.id, deliveredAt || atDays(Math.max(0, intakeDays - 5), 14)],
          );
          run('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?', [stockAfter, nowIso(), product.id]);
          product.stock = stockAfter;
          insert(
            `INSERT INTO inventory_movements (product_id, movement_type, quantity, stock_after, unit_cost, reason, reference_type, reference_id, notes, created_by, created_at)
             VALUES (?, 'SALIDA', ?, ?, ?, ?, 'REPARACION', ?, 'Consumo por orden de reparación', ?, ?)`,
            [
              product.id,
              -quantity,
              stockAfter,
              product.purchase_price,
              `Repuesto usado en orden OT-${currentYear}-${String(index + 1).padStart(4, '0')}`,
              orderId,
              admin.id,
              deliveredAt || atDays(Math.max(0, intakeDays - 5), 14),
            ],
          );
        }
      }

      createdOrders.push({ orderId, orderNumber: `OT-${currentYear}-${String(index + 1).padStart(4, '0')}`, intakeAt, status });
    });

    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const transactionDate = isoDate(date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const expenses = [
        ['Alquiler', 'Alquiler del local comercial', 180000, 'TRANSFERENCIA', 1],
        ['Sueldos', 'Honorarios del técnico principal', 250000, 'TRANSFERENCIA', 2],
        ['Servicios', 'Internet, luz y agua del taller', 36000, 'TRANSFERENCIA', 5],
        ['Compra de repuestos', 'Reposición de stock de repuestos', 82000, 'TRANSFERENCIA', 8],
      ];
      if (offset % 2 === 0) expenses.push(['Herramientas', 'Herramientas menores y consumibles', 28000, 'EFECTIVO', 12]);
      for (const [category, description, amount, method, day] of expenses) {
        insert(
          `INSERT INTO transactions (type, category, description, amount, method, transaction_date, notes, created_by, created_at)
           VALUES ('EGRESO', ?, ?, ?, ?, ?, 'Gasto operativo del período', ?, ?)`,
          [category, `${description} · ${month + 1}/${year}`, amount, method, `${transactionDate.slice(0, 8)}${String(day).padStart(2, '0')}`, admin.id, nowIso()],
        );
      }
      insert(
        `INSERT INTO transactions (type, category, description, amount, method, transaction_date, notes, created_by, created_at)
         VALUES ('INGRESO', 'Venta de repuestos', ?, ?, 'EFECTIVO', ?, 'Venta de mostrador', ?, ?)`,
        [`Venta de repuestos y accesorios · ${month + 1}/${year}`, 48000 + offset * 3500, `${transactionDate.slice(0, 8)}18`, admin.id, nowIso()],
      );
    }

    const recentActivity = [
      ['ORDER_STATUS', 'Actualización de estado de reparación', 2],
      ['PAYMENT_CREATE', 'Pago parcial registrado en caja', 4],
      ['INVENTORY_MOVEMENT', 'Salida de repuesto por reparación', 7],
      ['CLIENT_CREATE', 'Nuevo cliente registrado', 12],
      ['ORDER_CREATE', 'Ingreso de equipo registrado', 20],
      ['BACKUP_CREATE', 'Respaldo diario creado automáticamente', 26],
    ];
    for (const [action, description, hoursAgo] of recentActivity) {
      insert(
        `INSERT INTO activity_log (user_id, username, action, entity_type, entity_id, description, created_at)
         VALUES (?, 'admin', ?, 'system', NULL, ?, ?)`,
        [admin.id, action, description, new Date(now.getTime() - hoursAgo * 3600000).toISOString()],
      );
    }

    setSettings({ demo_seed_done: 'true' });
  });

  return { seeded: true, clients: CLIENTS.length, orders: createdOrders.length };
}

export function seedDemoData() {
  ensureBaseData();
  const alreadySeeded = get("SELECT value FROM settings WHERE key = 'demo_seed_done'");
  if (alreadySeeded?.value === 'true') {
    return { seeded: false, reason: 'La base ya fue inicializada; no se recargan datos demo.' };
  }
  if (!config.demoSeed) {
    return { seeded: false, reason: 'SEED_DEMO=false' };
  }
  if (get('SELECT COUNT(*) AS count FROM clients').count > 0) {
    return { seeded: false, reason: 'La base ya contiene datos.' };
  }
  return seedDemo();
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const result = seedDemoData();
  console.log(result.seeded ? `Datos demo cargados: ${result.orders} órdenes, ${result.clients} clientes.` : `Seed omitido: ${result.reason}`);
  closeDb();
}
