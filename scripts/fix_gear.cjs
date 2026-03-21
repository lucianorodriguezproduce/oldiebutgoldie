const fs = require('fs');

let c = fs.readFileSync('src/pages/Admin/AdminGear.tsx', 'utf8');

c = c.replace(/                            \)\}\r?\n                        <\/motion\.div>\r?\n                    <\/div>\r?\n                \)\}\r?\n            <\/AnimatePresence>/g, 
`                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>`);

fs.writeFileSync('src/pages/Admin/AdminGear.tsx', c);
console.log('JSX structure fixed.');
