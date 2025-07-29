const express = require('express');
const cors = require('cors');
const db = require('./database');
const { v4: uuidv4 } = require('uuid');
// const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
// app.use('/api', notificationRoutes);

// Helper function to handle database errors
const handleDatabaseError = (error, res) => {
  console.error('Database error:', error);
  res.status(500).json({ error: 'Internal server error' });
};

// Products endpoints
app.get('/api/products', async (req, res) => {
  try {
    const products = await db('products').select('*').orderBy('created_at', 'desc');
    res.json(products);
  } catch (error) {
    handleDatabaseError(error, res);
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const id = uuidv4();
    await db('products').insert({
      id,
      name: req.body.name,
      description: req.body.description || '',
      price: req.body.price,
      image: req.body.image || '',
      category: req.body.category || '',
      stock: req.body.stock || 0
    });
    const [product] = await db('products').where('id', id);
    res.status(201).json(product);
  } catch (error) {
    handleDatabaseError(error, res);
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db('products').where('id', id).update({
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      image: req.body.image,
      category: req.body.category,
      stock: req.body.stock
    });
    const [product] = await db('products').where('id', id);
    res.json(product);
  } catch (error) {
    handleDatabaseError(error, res);
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db('products').where('id', id).del();
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    handleDatabaseError(error, res);
  }
});

// Customers endpoints
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await db('customers').select('*');
    res.json(customers);
  } catch (error) {
    handleDatabaseError(error, res);
  }
});

// Orders endpoints
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await db('orders')
      .select(
        'orders.*',
        'customers.full_name as customer_name',
        'customers.email as customer_email',
        'customers.phone as customer_phone',
        'customers.address as customer_address',
        'customers.city as customer_city',
        'customers.postal_code as customer_postal_code'
      )
      .join('customers', 'orders.customer_id', 'customers.id')
      .orderBy('orders.created_at', 'desc');

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await db('order_items')
          .select(
            'order_items.*',
            'products.name as product_name',
            'products.description as product_description',
            'products.image as product_image',
            'products.category as product_category',
            'products.stock as product_stock'
          )
          .join('products', 'order_items.product_id', 'products.id')
          .where('order_items.order_id', order.id);

        return {
          ...order,
          items: items.map(item => ({
            product: {
              id: item.product_id,
              name: item.product_name,
              price: Number(item.price),
              description: item.product_description || '',
              image: item.product_image || '',
              category: item.product_category || '',
              stock: item.product_stock
            },
            quantity: item.quantity
          }))
        };
      })
    );

    res.json(ordersWithItems);
  } catch (error) {
    handleDatabaseError(error, res);
  }
});

app.post('/api/orders', async (req, res) => {
  const { customer, items, total, paymentInfo } = req.body;

  try {
    // Verifica se o cliente já existe pelo email
    let customerData;
    if (customer.email) {
      customerData = await db('customers')
        .where('email', customer.email)
        .first();
    }

    // Se não existir, cria novo cliente
    if (!customerData) {
      const customerId = uuidv4();
      await db('customers').insert({
        id: customerId,
        full_name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        postal_code: customer.zipCode
      });
      
      customerData = await db('customers')
        .where('id', customerId)
        .first();
    }

    // Cria o pedido
    const orderId = uuidv4();
    await db('orders').insert({
      id: orderId,
      customer_id: customerData.id,
      total: total,
      status: 'PENDING',
      payment_card_name: paymentInfo?.cardName,
      payment_card_number_masked: paymentInfo?.cardNumber ? 
        `****-****-****-${paymentInfo.cardNumber.slice(-4)}` : null,
      created_at: new Date(),
      updated_at: new Date()
    });

    // Cria os itens do pedido
    const orderItems = items.map(item => ({
      id: uuidv4(),
      order_id: orderId,
      product_id: item.product.id,
      quantity: item.quantity,
      price: item.product.price,
      created_at: new Date()
    }));

    await db('order_items').insert(orderItems);

    // DECREMENTA O ESTOQUE DOS PRODUTOS
    for (const item of items) {
      await db('products')
        .where('id', item.product.id)
        .decrement('stock', item.quantity);
    }

    // Obtém o pedido completo com relacionamentos
    const fullOrder = await db('orders')
      .leftJoin('customers', 'orders.customer_id', 'customers.id')
      .leftJoin('order_items', 'orders.id', 'order_items.order_id')
      .leftJoin('products', 'order_items.product_id', 'products.id')
      .where('orders.id', orderId)
      .select(
        'orders.*',
        'customers.full_name as customer_name',
        'customers.email as customer_email',
        'order_items.quantity as item_quantity',
        'order_items.price as item_price',
        'products.name as product_name'
      );

    // Formata a resposta
    const formattedOrder = {
      id: orderId,
      status: 'PENDING',
      total: total,
      customer: {
        id: customerData.id,
        name: customerData.full_name,
        email: customerData.email
      },
      items: items.map(item => ({
        product: {
          id: item.product.id,
          name: item.product.name,
          price: item.product.price
        },
        quantity: item.quantity
      })),
      payment_info: {
        card_name: paymentInfo?.cardName,
        card_number_masked: paymentInfo?.cardNumber ? 
          `****-****-****-${paymentInfo.cardNumber.slice(-4)}` : null
      },
      created_at: new Date()
    };

    res.status(201).json(formattedOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    let { status } = req.body;

    // Normaliza o status para maiúsculas
    status = status.toUpperCase();

    // Mapeia valores em português para os valores do ENUM
    const statusMap = {
      'PENDENTE': 'PENDING',
      'PAGO': 'PAID',
      'ENVIADO': 'SHIPPED',
      'ENTREGUE': 'DELIVERED', // ou 'ENTREGUE' se você adicionou ao ENUM
      'CANCELADO': 'CANCELLED'
    };

    // Usa o valor mapeado ou o valor original se não estiver no mapa
    const mappedStatus = statusMap[status] || status;

    // Se o novo status for CANCELADO, repõe o estoque dos produtos do pedido
    if (mappedStatus === 'CANCELLED') {
      const orderItems = await db('order_items').where('order_id', id);
      for (const item of orderItems) {
        await db('products')
          .where('id', item.product_id)
          .increment('stock', item.quantity);
      }
    }

    await db('orders')
      .where('id', id)
      .update({ 
        status: mappedStatus,
        updated_at: new Date() 
      });
    
    const [order] = await db('orders').where('id', id);
    
    res.json(order);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Stats endpoint

app.get('/api/stats', async (req, res) => {
  try {
    const productsCount = await db('products').count('* as count').first();

    const orderItemsData = await db('order_items')
      .select(
        'order_items.product_id',
        'order_items.quantity',
        'products.id',
        'products.name',
        'products.price',
        'products.image',
        'products.description'
      )
      .join('products', 'order_items.product_id', 'products.id');

    // Calculate most ordered product
    const productQuantities = {};
    
    orderItemsData.forEach(item => {
      if (item.product_id) {
        if (!productQuantities[item.product_id]) {
          productQuantities[item.product_id] = {
            quantity: 0,
            product: {
              id: item.id,
              name: item.name,
              price: item.price ? Number(item.price) : 0, // Garante que price seja um número
              image: item.image,
              description: item.description
            }
          };
        }
        productQuantities[item.product_id].quantity += item.quantity;
      }
    });

    const mostOrderedProductResult = Object.values(productQuantities).reduce((prev, current) => 
      (prev.quantity > current.quantity) ? prev : current, 
      { quantity: 0, product: null }
    );

    // Se não houver produtos pedidos, retornamos null para mostOrderedProduct
    const mostOrderedProduct = mostOrderedProductResult.quantity > 0 
      ? mostOrderedProductResult.product 
      : null;

    res.json({
      totalProducts: Number(productsCount?.count) || 0,
      mostOrderedProduct: mostOrderedProduct
    });
  } catch (error) {
    handleDatabaseError(error, res);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});