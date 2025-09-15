// Script de teste para verificar a API de pacientes
// Execute este script no console do navegador após fazer login

const BASE_URL = window.location.origin;

async function testPatientsAPI() {
  console.log('🧪 Testando API de Pacientes...');
  
  try {
    // 1. Testar listagem de pacientes
    console.log('\n📋 Testando GET /api/patients');
    const listResponse = await fetch(`${BASE_URL}/api/patients`);
    const listData = await listResponse.json();
    
    if (listResponse.ok) {
      console.log('✅ Lista de pacientes:', listData);
      console.log(`📊 Total de pacientes: ${listData.patients?.length || 0}`);
    } else {
      console.error('❌ Erro ao listar pacientes:', listData);
    }

    // 2. Testar criação de paciente
    console.log('\n➕ Testando POST /api/patients');
    const newPatient = {
      name: 'Paciente Teste API',
      email: 'teste@api.com',
      phone: '(11) 99999-9999',
      city: 'São Paulo',
      state: 'SP',
      birth_date: '1990-01-01',
      gender: 'M',
      medical_history: 'Paciente criado via teste da API',
      status: 'active'
    };

    const createResponse = await fetch(`${BASE_URL}/api/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newPatient),
    });
    
    const createData = await createResponse.json();
    
    if (createResponse.ok) {
      console.log('✅ Paciente criado:', createData);
      
      const patientId = createData.patient?.id;
      
      if (patientId) {
        // 3. Testar busca de paciente específico
        console.log('\n🔍 Testando GET /api/patients/[id]');
        const getResponse = await fetch(`${BASE_URL}/api/patients/${patientId}`);
        const getData = await getResponse.json();
        
        if (getResponse.ok) {
          console.log('✅ Paciente encontrado:', getData);
        } else {
          console.error('❌ Erro ao buscar paciente:', getData);
        }

        // 4. Testar atualização de paciente
        console.log('\n✏️ Testando PUT /api/patients/[id]');
        const updateData = {
          name: 'Paciente Teste API - Atualizado',
          medical_history: 'Paciente atualizado via teste da API'
        };

        const updateResponse = await fetch(`${BASE_URL}/api/patients/${patientId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });
        
        const updateResult = await updateResponse.json();
        
        if (updateResponse.ok) {
          console.log('✅ Paciente atualizado:', updateResult);
        } else {
          console.error('❌ Erro ao atualizar paciente:', updateResult);
        }

        // 5. Testar deleção de paciente
        console.log('\n🗑️ Testando DELETE /api/patients/[id]');
        const deleteResponse = await fetch(`${BASE_URL}/api/patients/${patientId}`, {
          method: 'DELETE',
        });
        
        const deleteData = await deleteResponse.json();
        
        if (deleteResponse.ok) {
          console.log('✅ Paciente deletado:', deleteData);
        } else {
          console.error('❌ Erro ao deletar paciente:', deleteData);
        }
      }
    } else {
      console.error('❌ Erro ao criar paciente:', createData);
    }

    // 6. Testar filtros
    console.log('\n🔍 Testando filtros');
    const filterTests = [
      { name: 'Busca por nome', url: `${BASE_URL}/api/patients?search=Ana` },
      { name: 'Filtro por status', url: `${BASE_URL}/api/patients?status=active` },
      { name: 'Paginação', url: `${BASE_URL}/api/patients?page=1&limit=2` }
    ];

    for (const test of filterTests) {
      const response = await fetch(test.url);
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${test.name}:`, data);
      } else {
        console.error(`❌ ${test.name}:`, data);
      }
    }

  } catch (error) {
    console.error('💥 Erro geral no teste:', error);
  }
}

// Executar teste
testPatientsAPI();