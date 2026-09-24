import { expect } from '@playwright/test';
import { fillOtp } from './auth.flow.js';

/** Lock-screen copy (hy + en). Snapshot: «Էջը տեսնելու համար անցեք նույնականացում». */
const UNLOCK_COPY =
    /To unlock the page|verify your profile|Verify my profile|Էջը տեսնելու համար|անցեք նույնականացում|Նույնականացման կոդը|էջը բացելու համար/i;

const VERIFY_BUTTON =
    /^(Verify my profile|Նույնականացվել|Հաստատել իմ պրոֆիլը|Հաստատել պրոֆիլը)$/i;

function log(msg) {
    console.log(`[ProfileVerification] ${msg}`);
}

function otpModal(page) {
    return page.locator('.modal__container').filter({
        has: page.locator('.enter-verificationCode, .otp, [data-id="enter-verification-code-phone"]'),
    });
}

function profileUnlockGate(page) {
    const empty = page.locator('.empty-container__content, .empty-container');
    return empty.filter({ hasText: UNLOCK_COPY })
        .or(page.getByText(/Էջը տեսնելու համար անցեք նույնականացում|To unlock the page/i));
}

function verifyProfileButton(page) {
    return page.getByRole('button', { name: VERIFY_BUTTON });
}

/**
 * Anything that locks the page until the profile is verified: the verify button on the
 * lock screen or the "Enter the code" modal. The test fixture registers it with
 * `page.addLocatorHandler`, so {@link handleProfileVerification} runs whenever it shows up.
 * @param {import('@playwright/test').Page} page
 */
export function profileVerificationGate(page) {
    return verifyProfileButton(page).or(otpModal(page));
}

/**
 * If the verify-profile empty state (or OTP modal) is on screen, complete it.
 * @returns {Promise<boolean>} true when the gate was present and handled
 */
export async function handleProfileVerification(page) {
    const modalOpen = await otpModal(page).first().isVisible();
    const button = verifyProfileButton(page).first();
    const gateVisible = await profileUnlockGate(page).first().isVisible();
    const buttonVisible = await button.isVisible();

    if (!modalOpen && !gateVisible && !buttonVisible) {
        return false;
    }

    log(`Page is locked — profile / phone verification required at ${page.url()}`);

    if (!modalOpen) {
        await expect(button).toBeVisible({ timeout: 10_000 });
        await button.click();
        log('Clicked verify button — waiting for "Enter the code" modal.');
    } else {
        log('OTP modal already open — filling verification code.');
    }

    const filledOtp = await fillOtp(page, { timeout: 20_000 });
    if (filledOtp) {
        log('Entered the verification code and clicked Continue.');
    } else {
        log('OTP modal did not appear — waiting for the lock screen to clear.');
    }

    await expect(verifyProfileButton(page)).toHaveCount(0, { timeout: 30_000 });
    log('Page unlocked after profile verification.');
    return true;
}
