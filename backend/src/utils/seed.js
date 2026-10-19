import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function upsertUsuario({ nombre, password, rol }) {
  const existing = await prisma.usuario.findFirst({ where: { nombre } });

  if (existing) {
    return existing;
  }

  return prisma.usuario.create({
    data: { nombre, password, rol, activo: true }
  });
}

async function upsertProveedor(data) {
  const existing = await prisma.proveedor.findUnique({ where: { ci: data.ci } });

  if (existing) {
    return existing;
  }

  return prisma.proveedor.create({ data });
}

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  try {
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const adminUser = await upsertUsuario({
      nombre: 'admin',
      password: adminPasswordHash,
      rol: 'ADMIN'
    });

    console.log('✅ Usuario administrador creado:', {
      id: adminUser.id,
      nombre: adminUser.nombre,
      rol: adminUser.rol
    });

    const moderadoPasswordHash = await bcrypt.hash('moderado123', 10);
    const moderadoUser = await upsertUsuario({
      nombre: 'operador',
      password: moderadoPasswordHash,
      rol: 'MODERADO'
    });

    console.log('✅ Usuario moderado creado:', {
      id: moderadoUser.id,
      nombre: moderadoUser.nombre,
      rol: moderadoUser.rol
    });

    const proveedores = [
      {
        nombreCompleto: 'Juan Carlos Pérez',
        ci: '12345678',
        telefono: '70123456',
        direccion: 'Av. Siempre Viva 123, La Paz',
        tipo: 'PERSONA_NATURAL'
      },
      {
        nombreCompleto: 'María Elena Rodríguez',
        ci: '87654321',
        telefono: '71987654',
        direccion: 'Calle Los Pinos 456, Cochabamba',
        tipo: 'PERSONA_NATURAL'
      },
      {
        nombreCompleto: 'Minera San Cristóbal S.A.',
        ci: '20345678901',
        telefono: '22445566',
        direccion: 'Zona Industrial, Potosí',
        tipo: 'EMPRESA'
      }
    ];

    for (const proveedorData of proveedores) {
      const proveedor = await upsertProveedor(proveedorData);
      console.log('✅ Proveedor creado:', {
        id: proveedor.id,
        nombre: proveedor.nombreCompleto,
        ci: proveedor.ci
      });
    }

    console.log('\n🎉 Seed completado exitosamente!');
    console.log('\n📋 Credenciales creadas:');
    console.log('👤 Admin - Usuario: admin, Contraseña: admin123');
    console.log('👤 Operador - Usuario: operador, Contraseña: moderado123');
  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
