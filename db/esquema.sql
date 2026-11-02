CREATE TABLE categorias (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  slug   VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE productos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nombre       VARCHAR(200) NOT NULL,
  descripcion  TEXT,
  precio       DECIMAL(10,2) NOT NULL,
  imagen       VARCHAR(255),
  stock        INT NOT NULL DEFAULT 0,
  destacado    BOOLEAN DEFAULT FALSE,
  categoria_id INT,
  creado_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
);

CREATE TABLE usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  proveedor     ENUM('credenciales','google') DEFAULT 'credenciales',
  rol           ENUM('cliente','admin') DEFAULT 'cliente',
  creado_en     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pedidos (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id     INT NOT NULL,
  total          DECIMAL(10,2) NOT NULL,
  estado         ENUM('pendiente','pagado','enviado','entregado','cancelado') DEFAULT 'pendiente',
  stripe_session VARCHAR(255),
  creado_en      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE pedido_lineas (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id   INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad    SMALLINT NOT NULL,
  precio_unit DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE carrito_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad    SMALLINT NOT NULL DEFAULT 1,
  UNIQUE(usuario_id, producto_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

INSERT INTO categorias (nombre, slug) VALUES
  ('Electrónica', 'electronica'),
  ('Ropa', 'ropa'),
  ('Hogar', 'hogar');

INSERT INTO productos (nombre, descripcion, precio, imagen, stock, destacado, categoria_id) VALUES
  ('Auriculares Bluetooth', 'Cancelación de ruido activa', 59.99, '/img/auriculares.jpg', 25, TRUE, 1),
  ('Camiseta Básica', 'Algodón 100%, varios colores', 14.99, '/img/camiseta.jpg', 100, FALSE, 2),
  ('Lámpara LED', 'Regulable, luz cálida y fría', 29.99, '/img/lampara.jpg', 40, TRUE, 3),
  ('Teclado Mecánico', 'Switches Cherry MX, RGB', 89.99, '/img/teclado.jpg', 15, TRUE, 1),
  ('Mochila Urban', 'Compartimento portátil, impermeable', 39.99, '/img/mochila.jpg', 30, FALSE, 2);