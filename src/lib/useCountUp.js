import React, { useEffect, useState } from "react";

// 轻量数字滚动动画：从 0 数到 target（三次缓动）
export default function useCountUp(target, duration) {
  duration = duration || 600;
  const [val, setVal] = useState(0);
  useEffect(function () {
    var raf = null;
    var start = performance.now();
    function tick(now) {
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round((target || 0) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return function () { if (raf) cancelAnimationFrame(raf); };
  }, [target, duration]);
  return val;
}