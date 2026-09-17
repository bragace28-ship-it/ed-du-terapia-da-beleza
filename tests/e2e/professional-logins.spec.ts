import { test, expect } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'https://ed-du-terapia-da-beleza.pages.dev/'
const password = process.env.HOMOLOG_USER_PASSWORD

const professionals = [
  { email: 'carlos@ededuterapiadabeleza.online', name: 'Carlos' },
  { email: 'du@ededuterapiadabeleza.online', name: 'Du' },
  { email: 'ed@ededuterapiadabeleza.online', name: 'Ed / Edgar' },
]

test.describe('V33 professional authentication', () => {
  for (const professional of professionals) {
    test(`${professional.name} can enter the professional area`, async ({ page }) => {
      test.skip(!password, 'HOMOLOG_USER_PASSWORD is required for authenticated E2E')
      await page.goto(baseURL, { waitUntil: 'networkidle' })
      await page.getByLabel('E-mail').fill(professional.email)
      await page.getByLabel('Senha').fill(password!)
      await page.getByRole('button', { name: 'Entrar', exact: true }).click()
      await expect(page.getByText('ÁREA DO PROFISSIONAL')).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('heading', { name: `Olá, ${professional.name}.` })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Profissional', exact: true })).toBeVisible()
    })
  }
})
