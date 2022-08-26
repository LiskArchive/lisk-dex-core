import {
    sqrt
} from '../../../../src/app/modules/dex/utils/math_constants'
import {
    MAX_SQRT_RATIO
} from '../../../../src/app/modules/dex/constants'

describe('sqrt', () => {
    it('should calculate sqrt', async () => {
        expect(sqrt(BigInt(100))).toBe(BigInt(10));
        expect(sqrt(MAX_SQRT_RATIO)).toBe(BigInt('1208903099313551102292995'));

    });
});