import puppeteer from "puppeteer-extra";
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import fs from 'fs';
import numeros from "./numeros.json" with {type: "json"};
import 'dotenv/config'
import { read } from 'xlsx/xlsx.mjs';

puppeteer.use(
    RecaptchaPlugin({
        provider: { id: '2captcha', token: '2b4828d5e6a9596e4b294da47a60a1f8' }
    })
);

class SearchNumber {
    WEB = "https://numeracionyoperadores.cnmc.es/portabilidad/movil";
    Token = process.env.TOKEN;
    browser;
    header = "NUMERO, OPERADOR";
    constructor() {
        console.log("   Iniciando...");
    }
    async start(numeros) {
        this.browser = await puppeteer.launch({
            headless: false,
            //slowMo: 400
            args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
        });
        let content = undefined;
        try {
            // Consultar el contenido del CSV
            content = fs.readFileSync('datos.csv', 'utf-8')
        } catch (error) {
            // En caso de no existir el CSV, crearlo
            console.log("   Creando el CSV...");
            fs.writeFileSync('datos.csv', this.header + '\n');
        }

        const page = await this.browser.newPage();
        page.goto(this.WEB)
        await new Promise(r => setTimeout(r, 5000))
        await page.click("button[class='v-btn v-btn--elevated v-btn--slim v-theme--light v-btn--density-default v-btn--size-default v-btn--variant-elevated']");

        let CSV = "";

        for (let i = 0; i < numeros.length; i++) {
            await page.click("input[id='input-3']")
            await page.waitForSelector('#input-3')
            await clearInput(page, { selector: '#input-3' })
            await page.type('#input-3', numeros[i].toString());
            await page.evaluate(() => {
                window.scrollBy(0, window.innerHeight);
            });
            
            const { solved, error } = await page.solveRecaptchas();
            if (solved) {
                console.log('✔️ The captcha has been solved');
            }
            if (error) console.log(error);

            
            await page.click("button[class='v-btn v-btn--elevated v-theme--light bg-warning v-btn--density-default v-btn--size-x-large v-btn--variant-elevated mt-4']")
            await new Promise(r => setTimeout(r, 5000))
            const element = await page.$eval('.v-card', (e) => {
                return e.innerHTML
            });

            let preFragmento = element.slice(662);
            let operador = preFragmento.split("<")[0];

            CSV += `${numeros[i]}, ${operador} \n`

            content = fs.readFileSync('datos.csv', 'utf-8')
            fs.writeFileSync('datos.csv', content + '\n' + numeros[i] + ', ' + operador + '\n');

            console.log(CSV);
            
        }

        await this.browser.close()
    }
}

const clearInput = async (page, { selector }) => {
    const input = await page.$(selector)
    await input.click({ clickCount: 3 })
    await page.keyboard.press('Backspace')
}

//const searchNumber = new SearchNumber();
//searchNumber.start(numeros)

const buf = fs.readFileSync("10K.xlsx")
const work = read(buf)


