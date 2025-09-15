-- Script para corrigir políticas RLS da tabela users
-- Execute este script no Supabase SQL Editor

-- Primeiro, vamos verificar as políticas existentes
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Adicionar política para permitir que usuários se insiram na tabela users
CREATE POLICY "Users can insert themselves" ON users 
FOR INSERT WITH CHECK (auth.uid() = id);

-- Adicionar política para permitir que usuários vejam seus próprios dados
CREATE POLICY "Users can view own data" ON users 
FOR SELECT USING (auth.uid() = id);

-- Adicionar política para permitir que usuários atualizem seus próprios dados
CREATE POLICY "Users can update own data" ON users 
FOR UPDATE USING (auth.uid() = id);

-- Verificar se as políticas foram criadas
SELECT * FROM pg_policies WHERE tablename = 'users';
