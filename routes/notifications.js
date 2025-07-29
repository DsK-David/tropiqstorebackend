const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// Configure nodemailer transporter
const transporter = nodemailer.createTransporter({
  service: 'gmail', // ou outro provedor como 'outlook', 'yahoo', etc.
  auth: {
    user: process.env.EMAIL_USER || 'seu-email@gmail.com', // Configure no .env
    pass: process.env.EMAIL_PASS || 'sua-senha-de-app'     // Configure no .env
  }
});

// Real email sending function using nodemailer
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'tropiq.store@gmail.com',
      to: to,
      subject: subject,
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`Email enviado com sucesso para: ${to}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`Erro ao enviar email para ${to}:`, error);
    throw error;
  }
};

router.post('/send-notification', async (req, res) => {
  try {
    const { type, productName, adminEmails } = req.body;
    
    let subject, html;
    
    switch (type) {
      case 'product_deleted':
        subject = 'Produto Excluído - Tropiq Store';
        html = `
          <h2>Produto Excluído</h2>
          <p>O produto <strong>${productName}</strong> foi excluído do sistema.</p>
          <p>Data: ${new Date().toLocaleString()}</p>
          <p>Sistema: Tropiq Store Admin</p>
        `;
        break;
      
      case 'product_created':
        subject = 'Novo Produto Adicionado - Tropiq Store';
        html = `
          <h2>Novo Produto Adicionado</h2>
          <p>O produto <strong>${productName}</strong> foi adicionado ao sistema.</p>
          <p>Data: ${new Date().toLocaleString()}</p>
          <p>Sistema: Tropiq Store Admin</p>
        `;
        break;
        
      case 'order_created':
        const { customerName, orderId, orderTotal } = req.body;
        subject = 'Novo Pedido Recebido - Tropiq Store';
        html = `
          <h2>Novo Pedido Recebido</h2>
          <p>Um novo pedido foi realizado na loja.</p>
          <p><strong>Pedido:</strong> #${orderId.slice(0, 8)}</p>
          <p><strong>Cliente:</strong> ${customerName}</p>
          <p><strong>Valor Total:</strong> ${orderTotal} CVE</p>
          <p><strong>Data:</strong> ${new Date().toLocaleString()}</p>
          <p>Sistema: Tropiq Store</p>
        `;
        break;
        
      default:
        return res.status(400).json({ error: 'Tipo de notificação inválido' });
    }
    
    // Send emails to all admin emails
    const emailPromises = adminEmails.map(email => 
      sendEmail(email, subject, html)
    );
    
    await Promise.all(emailPromises);
    
    res.json({ 
      success: true, 
      message: `Notificação enviada para ${adminEmails.length} administradores` 
    });
    
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    res.status(500).json({ error: 'Erro ao enviar notificação' });
  }
});

module.exports = router;