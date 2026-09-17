import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const baseURL = process.env.E2E_BASE_URL ?? 'https://ed-du-terapia-da-beleza.pages.dev/'
const email = process.env.HOMOLOG_USER_EMAIL ?? 'admin.homologacao@ededuterapiadabeleza.online'
const password = process.env.HOMOLOG_USER_PASSWORD
const artifactDir = 'tests/e2e/artifacts'

if (!password) throw new Error('HOMOLOG_USER_PASSWORD is required for authenticated E2E.')
fs.mkdirSync(artifactDir, { recursive: true })

test('V33 production: login -> command -> PDV -> finance', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Entrar no aplicativo' })).toBeVisible()
  await page.screenshot({ path: `${artifactDir}/01-login.png`, fullPage: true })

  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Área do profissional')).toBeVisible({ timeout: 15000 })
  await page.screenshot({ path: `${artifactDir}/02-profissional-shell.png`, fullPage: true })

  await page.getByRole('button', { name: 'Comandas', exact: true }).click()
  await page.getByRole('button', { name: '+ Nova comanda' }).click()
  await expect(page.getByText('R$ 150,00')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('OPEN', { exact: true })).toBeVisible()
  await page.screenshot({ path: `${artifactDir}/03-comanda-150.png`, fullPage: true })

  await page.getByRole('button', { name: 'Fechar / Enviar pagamento' }).first().click()
  await expect(page.getByText('PAGAMENTO · R$ 150,00')).toBeVisible()
  await expect(page.locator('.ranking .rank-row')).toHaveCount(5)
  await page.screenshot({ path: `${artifactDir}/04-ranking-liquidez.png`, fullPage: true })

  await page.getByRole('button', { name: 'PDV / Maquininha', exact: true }).click()
  await page.getByLabel('Referência da maquininha').fill(`E2E-${Date.now()}`)
  await page.getByRole('button', { name: 'Confirmar pagamento presencial' }).click()
  await expect(page.getByText('PAID', { exact: true }).first()).toBeVisible({ timeout: 15000 })
  await page.screenshot({ path: `${artifactDir}/05-pdv-paid.png`, fullPage: true })

  await page.getByRole('button', { name: 'Financeiro', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Financeiro' })).toBeVisible()
  await expect(page.getByText('R$ 150,00').first()).toBeVisible({ timeout: 15000 })
  await page.screenshot({ path: `${artifactDir}/06-financeiro-150.png`, fullPage: true })
})
