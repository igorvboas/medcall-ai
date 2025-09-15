-- Script para inserir dados de teste para a página de pacientes
-- Execute este script no Supabase SQL Editor

-- Primeiro, vamos criar um usuário médico de teste
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'doctor@medcall.com',
  '$2a$10$example_hashed_password',
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Inserir o médico na tabela users
INSERT INTO users (
  id,
  email,
  name,
  role,
  created_at,
  updated_at
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'doctor@medcall.com',
  'Dr. João Silva',
  'doctor',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Inserir pacientes de teste
INSERT INTO patients (
  id,
  doctor_id,
  name,
  email,
  phone,
  city,
  state,
  birth_date,
  gender,
  cpf,
  address,
  emergency_contact,
  emergency_phone,
  medical_history,
  allergies,
  current_medications,
  status,
  created_at,
  updated_at
) VALUES 
(
  uuid_generate_v4(),
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Ana Silva Santos',
  'ana.silva@email.com',
  '(11) 98765-4321',
  'São Paulo',
  'SP',
  '1985-03-15',
  'F',
  '111.222.333-44',
  'Rua das Flores, 123 - Centro',
  'Maria Silva (Mãe)',
  '(11) 98765-4322',
  'Hipertensão arterial, diabetes tipo 2',
  'Penicilina, sulfa',
  'Metformina 500mg, Losartana 50mg',
  'active',
  NOW(),
  NOW()
),
(
  uuid_generate_v4(),
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Bruno Costa Oliveira',
  'bruno.costa@email.com',
  '(21) 99887-6655',
  'Rio de Janeiro',
  'RJ',
  '1990-07-22',
  'M',
  '555.666.777-88',
  'Av. Copacabana, 456 - Copacabana',
  'Carla Costa (Esposa)',
  '(21) 99887-6656',
  'Asma, rinite alérgica',
  'Aspirina',
  'Salbutamol, Cetirizina',
  'active',
  NOW(),
  NOW()
),
(
  uuid_generate_v4(),
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Carlos Eduardo Pereira',
  'carlos.pereira@email.com',
  '(31) 91234-5678',
  'Belo Horizonte',
  'MG',
  '1978-11-08',
  'M',
  '999.888.777-66',
  'Rua da Liberdade, 789 - Savassi',
  'Ana Pereira (Filha)',
  '(31) 91234-5679',
  'Colesterol alto, histórico familiar de cardiopatia',
  'Nenhuma conhecida',
  'Sinvastatina 20mg',
  'active',
  NOW(),
  NOW()
),
(
  uuid_generate_v4(),
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Débora Almeida Lima',
  'debora.almeida@email.com',
  '(85) 98765-4321',
  'Fortaleza',
  'CE',
  '1992-05-30',
  'F',
  '444.555.666-77',
  'Av. Beira Mar, 321 - Meireles',
  'Roberto Lima (Marido)',
  '(85) 98765-4322',
  'Depressão, ansiedade',
  'Fluoxetina',
  'Fluoxetina 20mg, Alprazolam 0.5mg',
  'inactive',
  NOW(),
  NOW()
),
(
  uuid_generate_v4(),
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Eduardo Santos Ferreira',
  'eduardo.santos@email.com',
  '(51) 91234-5678',
  'Porto Alegre',
  'RS',
  '1983-09-12',
  'M',
  '777.888.999-00',
  'Rua da Independência, 654 - Centro',
  'Patrícia Ferreira (Esposa)',
  '(51) 91234-5679',
  'Gastrite, refluxo gastroesofágico',
  'Ibuprofeno',
  'Omeprazol 20mg',
  'active',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Verificar se os dados foram inseridos
SELECT 
  p.name,
  p.email,
  p.phone,
  p.city,
  p.state,
  p.status,
  u.name as doctor_name
FROM patients p
JOIN users u ON p.doctor_id = u.id
WHERE u.email = 'doctor@medcall.com'
ORDER BY p.created_at DESC;
