import fs from 'fs';
import puppeteer from "puppeteer-extra";
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import 'dotenv/config'
import { read } from "xlsx";
import path from 'path'

type WorkStringsType = {
    t: string,
    r: string,
    h: string
}

const WEB: string = "https://numeracionyoperadores.cnmc.es/portabilidad/movil";
const buf = fs.readFileSync(path.join(__dirname, '../10k.xlsx'))
const work = read(buf)
const header: string = "NUMERO; OPERADOR; FECHA CONSULTA";

// @ts-ignore
const WorkStrings: Array<WorkStringsType[]> | any = work.Strings;

puppeteer.use(
    RecaptchaPlugin({
        provider: { id: '2captcha', token: '2b4828d5e6a9596e4b294da47a60a1f8' }
    })
);

const Start = async () => {
    let contVeces: number = 101;
    let content = undefined;
    let CSV = "";
    try {
        // Consultar el contenido del CSV
        content = fs.readFileSync('datos.csv', 'utf-8')
    } catch (error) {
        // En caso de no existir el CSV, crearlo
        console.log("   Creando el CSV...");
        fs.writeFileSync('datos.csv', header + '\n');
    }
    while (contVeces < 100) {
        // @ts-ignore
        console.log("   Procesando numero: " + WorkStrings[contVeces].t);
        const browser = await puppeteer.launch({
            headless: false,
            //slowMo: 400
            args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
        });

        const page = await browser.newPage();
        page.goto(WEB)
        await new Promise(r => setTimeout(r, 5000))
        await page.click("button[class='v-btn v-btn--elevated v-btn--slim v-theme--light v-btn--density-default v-btn--size-default v-btn--variant-elevated']");
        await page.click("input[id='input-3']")
        await page.waitForSelector('#input-3')
        await clearInput(page, { selector: '#input-3' })
        await page.type('#input-3', WorkStrings[contVeces].t.toString());
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
        let fecha = preFragmento.split("<")[4].substring(2);
        CSV += `${WorkStrings[contVeces].t.toString()}, ${operador} \n`

        content = fs.readFileSync('datos.csv', 'utf-8')
        fs.writeFileSync('datos.csv', content + '\n' + WorkStrings[contVeces].t.toString() + '; ' + operador + '; ' + fecha);

        console.log(CSV);


        await browser.close()
        contVeces++;

    }

}

const clearInput = async (page, { selector }) => {
    const input = await page.$(selector)
    await input.click({ clickCount: 3 })
    await page.keyboard.press('Backspace')
}

Start();