import fs from 'fs';
import puppeteer from "puppeteer-extra";
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import 'dotenv/config'
import { read } from "xlsx";
import path from 'path'
import axios from 'axios'

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
    let contVeces: number = 1;
    let iterador: number = 1;
    let content: string;
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
        let queryContent: string = fs.readFileSync('datos.csv', 'utf-8');

        do {
            iterador++;
            //console.log(iterador);
        } while (queryContent.search(WorkStrings[iterador].t.toString()) != -1);

        console.log("   Procesando numero: " + WorkStrings[iterador].t);
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
        await page.type('#input-3', WorkStrings[iterador].t.toString());
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
        });
        const msg: string = await page.$eval("div[class='v-alert v-theme--light bg-warning v-alert--density-default v-alert--variant-flat alert-transparency']", (e) => {
            return e.querySelector(".v-alert__content").innerHTML
        });
        let matches = msg.match(/(\d+)/);
        const intentos = matches[0];
        if (intentos == '0') {
            console.log("   Se ha excedido los intentos");
            break;
        }

        /*const iframe = await page.$eval('iframe', (e) => {
            return e.src
        });
        console.log("   Haciendo peticion a la API");
        await getCaptcha(iframe)
        console.log("\n");*/

        const { solved, error } = await page.solveRecaptchas();
        if (solved) {
            console.log('   ✔️ The captcha has been solved');
        }
        if (error) console.log("Error");

        try {
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
        } catch (error) {
            console.log("   Error inesperado, reintentando");
        }


        await browser.close()
        contVeces++;
    }

}

const getCaptcha = async (src: string) => {
    const slice = src.split("=");
    const key = slice[2].split("&");
    const API_KEY = "27bb8dfbf288282aa317d93d8720d810";
    const { data } = await axios.get(`https://ocr.captchaai.com/in.php?key=${API_KEY}&method=userrecaptcha&googlekey=${key[0]}&pageurl=https://mysite.com/page/with/recaptcha`);
    let id_captcha: string;
    id_captcha = data.split('|')

    console.log("   ID del captcha: " + id_captcha[1]);
    await new Promise(r => setTimeout(r, 15000))
    let code = await axios.get(`https://ocr.captchaai.com/res.php?key=${API_KEY}&action=get&id=${id_captcha[1]}`)
    console.log("   Respuesta " + code.data);

    while (await queryApi(API_KEY, id_captcha[1]) == "CAPCHA_NOT_READY") {
        console.log("   Reintentando");

        await new Promise(r => setTimeout(r, 15000))
        code = await queryApi(API_KEY, id_captcha[1])
        console.log(code);

    }

}

const queryApi: any = async (API_KEY: string, captcha: any) => {

    let rs = await axios.get(`https://ocr.captchaai.com/res.php?key=${API_KEY}&action=get&id=${captcha}`)
    return rs.data
}

const clearInput = async (page, { selector }) => {
    const input = await page.$(selector)
    await input.click({ clickCount: 3 })
    await page.keyboard.press('Backspace')
}

Start();