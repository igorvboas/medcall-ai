const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Carrega variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAndFixTimestamps() {
  console.log('🧪 Testando timestamps atuais...');
  
  try {
    // Testar inserção com timestamp grande (como os que estão falhando)
    const testTimestamp = 1757602447877; // Timestamp que estava falhando nos logs
    console.log(`📊 Testando timestamp: ${testTimestamp}`);
    
    const { data, error: insertError } = await supabase
      .from('utterances')
      .insert({
        session_id: '00000000-0000-0000-0000-000000000000',
        speaker: 'system',
        text: 'Teste de timestamp - não apagar',
        start_ms: testTimestamp,
        end_ms: testTimestamp + 1000,
        is_final: true
      })
      .select();
    
    if (insertError) {
      console.log('❌ ERRO CONFIRMADO:', insertError.message);
      
      if (insertError.message.includes('out of range for type integer')) {
        console.log('\n🔧 APLICANDO CORREÇÃO...');
        
        // Vamos tentar fazer a alteração por partes
        console.log('1️⃣ Alterando start_ms para BIGINT...');
        const { error: error1 } = await supabase.rpc('exec_sql', {
          sql: 'ALTER TABLE utterances ALTER COLUMN start_ms TYPE BIGINT;'
        });
        
        if (error1) {
          console.log('❌ Erro ao alterar start_ms:', error1.message);
        } else {
          console.log('✅ start_ms alterado para BIGINT');
        }
        
        console.log('2️⃣ Alterando end_ms para BIGINT...');
        const { error: error2 } = await supabase.rpc('exec_sql', {
          sql: 'ALTER TABLE utterances ALTER COLUMN end_ms TYPE BIGINT;'
        });
        
        if (error2) {
          console.log('❌ Erro ao alterar end_ms:', error2.message);
        } else {
          console.log('✅ end_ms alterado para BIGINT');
        }
        
        // Testar novamente após a correção
        console.log('3️⃣ Testando novamente após correção...');
        const { data: retestData, error: retestError } = await supabase
          .from('utterances')
          .insert({
            session_id: '00000000-0000-0000-0000-000000000000',
            speaker: 'system',
            text: 'Teste pós-correção',
            start_ms: testTimestamp,
            end_ms: testTimestamp + 1000,
            is_final: true
          })
          .select();
        
        if (retestError) {
          console.log('❌ Ainda há erro após correção:', retestError.message);
          console.log('\n📋 Execute manualmente no Supabase Dashboard (SQL Editor):');
          console.log('ALTER TABLE utterances ALTER COLUMN start_ms TYPE BIGINT;');
          console.log('ALTER TABLE utterances ALTER COLUMN end_ms TYPE BIGINT;');
        } else {
          console.log('✅ CORREÇÃO BEM-SUCEDIDA! Timestamps agora funcionam');
          
          // Limpar testes
          await supabase
            .from('utterances')
            .delete()
            .in('text', ['Teste de timestamp - não apagar', 'Teste pós-correção']);
        }
      }
    } else {
      console.log('✅ Timestamps já estão funcionando corretamente!');
      console.log('📊 Dados inseridos:', data);
      
      // Limpar teste
      await supabase
        .from('utterances')
        .delete()
        .eq('text', 'Teste de timestamp - não apagar');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
    console.log('\n📋 Aplique manualmente no Supabase Dashboard:');
    console.log('ALTER TABLE utterances ALTER COLUMN start_ms TYPE BIGINT;');
    console.log('ALTER TABLE utterances ALTER COLUMN end_ms TYPE BIGINT;');
  }
}

testAndFixTimestamps();
